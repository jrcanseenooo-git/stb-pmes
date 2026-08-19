/**
 * DataCacheService.gs
 *
 * Two-tier read cache for sheet data.
 *
 * WHY THIS EXISTS
 * ---------------
 * `SpreadsheetService.getAllRows()` calls `sheet.getDataRange().getValues()`,
 * which is a full-sheet network round trip to the Sheets backend. It is called
 * ~90 times across the services, and several times within a single request:
 * ReportsService alone calls it 16 times, IPCRFService 16, and the rater
 * assignment service 14. A dashboard load could therefore re-read the same
 * Users tab half a dozen times. That is the dominant cause of slow page loads,
 * not the size of the database.
 *
 * TIER 1 - per-execution memo (always on, zero staleness risk)
 *   A plain object living for the life of one Apps Script execution. The second
 *   and subsequent reads of the same tab in the same request are free. Because
 *   an execution is single-threaded and the memo dies with it, this can never
 *   serve data older than the current request. Any write through
 *   SpreadsheetService busts the entry immediately.
 *
 * TIER 2 - cross-execution CacheService (opt-in, reference tables only)
 *   Shared between users and executions, so one person's read warms it for
 *   everyone. Restricted to an explicit allowlist of slow-moving reference
 *   tables (assessment content, categories, rules, org units, registry).
 *   Transactional tables - ratings, assignments, assessment records, users -
 *   are deliberately NOT cross-execution cached: serving a stale rating or a
 *   stale assignment would be a correctness bug, and no amount of speed is
 *   worth that.
 *
 * Both tiers key on spreadsheetId + tab name. This matters: office scoping
 * means the same tab name ("Personnel") exists in every office spreadsheet, so
 * keying on name alone would leak one office's data into another's cache.
 */
const DataCacheService = (() => {

  // Tier 2 allowlist. Reference data only - changed by administrators, read by
  // everyone, and harmless if a few minutes stale.
  const REFERENCE_SHEETS = [
    'AssessmentContent',
    'AssessmentCategories',
    'AssessmentRules',
    'Divisions',
    'OrganizationalUnits',
    'Sections',
    'Positions',
    'OfficeRegistry',
    'SystemSettings',
    'MasterKRALibrary',
    'AssessmentPeriods',
    // Admin-configured, slow-changing, central-only - same category as the
    // sheets above. Both write paths already call DataCacheService.invalidate
    // after writing (RaterMatrixService.save via hardDeleteRow/appendRow;
    // OfficeRegistryService.replaceOrgOptionRows_ explicitly, since it writes
    // via a raw setValues range rather than through SpreadsheetService), so
    // adding them here is safe: an edit is never served stale past the write
    // that changed it, only softened against repeat reads between edits.
    'RaterMatrix',
    'OfficeOrgOptions'
  ]

  // Short enough that an administrator's change shows up quickly even if an
  // invalidation is somehow missed; long enough to absorb a burst of users
  // opening the same screen.
  const REFERENCE_TTL_SECONDS = 300

  // CacheService rejects values over 100KB per key. Anything larger is simply
  // not cached at tier 2 rather than throwing.
  const MAX_CACHE_BYTES = 95 * 1024

  // Tier 1 store. Reset per execution because module state does not survive
  // between Apps Script invocations.
  let memo = {}
  let memoHits = 0
  let memoMisses = 0

  function keyFor(spreadsheetId, sheetName) {
    return String(spreadsheetId || 'default') + '::' + String(sheetName || '')
  }

  function isReferenceSheet(sheetName) {
    return REFERENCE_SHEETS.indexOf(String(sheetName || '')) >= 0
  }

  function scriptCache_() {
    try { return CacheService.getScriptCache() } catch (e) { return null }
  }

  /**
   * Read-through cache around a producer that returns an array of row objects.
   *
   * @param {string} spreadsheetId  Owning spreadsheet - required for isolation.
   * @param {string} sheetName      Tab name.
   * @param {function} producer     Called only on a miss; must return an array.
   */
  function readThrough(spreadsheetId, sheetName, producer) {
    const key = keyFor(spreadsheetId, sheetName)

    // Tier 1
    if (Object.prototype.hasOwnProperty.call(memo, key)) {
      memoHits++
      return memo[key]
    }
    memoMisses++

    // Tier 2 - reference tables only
    if (isReferenceSheet(sheetName)) {
      const cache = scriptCache_()
      if (cache) {
        try {
          const raw = cache.get(key)
          if (raw) {
            const parsed = JSON.parse(raw)
            memo[key] = parsed
            return parsed
          }
        } catch (e) {
          // A corrupt or truncated entry must never break a read.
          Logger.log('[DataCache] tier-2 read failed for ' + key + ': ' + e.message)
        }
      }
    }

    const rows = producer()
    memo[key] = rows

    if (isReferenceSheet(sheetName)) {
      const cache = scriptCache_()
      if (cache) {
        try {
          const payload = JSON.stringify(rows)
          if (payload.length <= MAX_CACHE_BYTES) {
            cache.put(key, payload, REFERENCE_TTL_SECONDS)
          }
        } catch (e) {
          Logger.log('[DataCache] tier-2 write skipped for ' + key + ': ' + e.message)
        }
      }
    }

    return rows
  }

  /** Drop both tiers for one tab. Called by every SpreadsheetService write. */
  function invalidate(spreadsheetId, sheetName) {
    const key = keyFor(spreadsheetId, sheetName)
    delete memo[key]
    if (isReferenceSheet(sheetName)) {
      const cache = scriptCache_()
      if (cache) {
        try { cache.remove(key) } catch (e) { /* best effort */ }
      }
    }
  }

  /** Drop the whole per-execution memo. Used by long-running admin jobs. */
  function clearMemo() {
    memo = {}
  }

  function stats() {
    return { hits: memoHits, misses: memoMisses, entries: Object.keys(memo).length }
  }

  return {
    readThrough,
    invalidate,
    clearMemo,
    stats,
    isReferenceSheet,
    REFERENCE_TTL_SECONDS
  }
})()
