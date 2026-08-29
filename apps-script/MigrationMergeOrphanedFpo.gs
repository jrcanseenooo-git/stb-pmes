/**
 * MigrationMergeOrphanedFpo.gs
 *
 * One-off migration. Run from the Apps Script editor's Run dropdown.
 * `clasp run` is unreliable here - it returns NOT_FOUND with no readable output
 * while sometimes still executing - so always run this from the editor and read
 * the log.
 *
 * WHY
 * A duplicate-record guard in IPATService.create compared `r.semester` (a Number
 * in the sheet) with `body.semester` (a String from the request), so it never
 * fired. That produced duplicate AssessmentRecords for the same ratee and
 * period. The guard is fixed, so no new duplicates appear, but 34 of 44
 * ratee/period keys in production still carry legacy duplicates.
 *
 * The duplicates are COMPLEMENTARY, not contradictory. The typical pair is:
 *   - one record holding CBC and JF, linked to the rater assignments
 *   - one record holding a manually encoded FPO, linked to nothing
 *
 * findCanonicalRecord ranks by linked assignments, so the CBC/JF record wins and
 * is what everyone sees. The FPO sits in the orphan and never counts - and FPO
 * is 55% of the total weight. calculateOverall then renormalises CBC and JF to
 * fill 100%, so the displayed score looks complete while missing the largest
 * component. At least one person is shown a full descriptor band lower than
 * their own data supports.
 *
 * WHAT IT DOES
 * For each ratee/period group with more than one record, picks the canonical
 * record using the SAME ranking findCanonicalRecord uses, and if that record has
 * no FPO while exactly ONE sibling does, copies the FPO across (with its
 * position category and weight factor) and recomputes the overall score through
 * calculateOverall - the same function the app uses, so deductions and FPO
 * rescaling are handled identically.
 *
 * DELIBERATELY CONSERVATIVE:
 *   - Only acts when exactly one sibling has an FPO. Two competing FPO values
 *     is a question for a human, not a guess for a script.
 *   - Never overwrites an FPO the canonical record already has.
 *   - Never deletes or edits the orphan. Nothing is destroyed; the orphan keeps
 *     its own copy and remains excluded from every read path.
 *   - Only ever ADDS a missing component, so a score can move up or down but is
 *     always built from more of the person's real data than before.
 *
 * SAFE TO RE-RUN: once merged, the canonical record has an FPO and no longer
 * qualifies. A second run reports 0.
 *
 * ALWAYS run previewMergeOrphanedFpo() first and read the log.
 *
 * ── RUN AND VERIFIED 2026-08-29 (central workbook) ──────────────────────────
 * 4 merged, 7 skipped, 0 ambiguous. Every result matched an offline simulation
 * to the decimal, which is what confirms the migration reproduced the app's own
 * formula rather than a parallel one:
 *
 *   Jean Pauline H. Villaruel  3.47 Satisfactory      -> 3.76 Very Satisfactory
 *   Gerardo III B. Badana      3.58                   -> 3.71 Very Satisfactory
 *   Jelie B. Barceta           3.83                   -> 3.87 Very Satisfactory
 *   Kyrie Eleison Taganap      3.75                   -> 3.77 Very Satisfactory
 *
 * Villaruel is the substantive correction: her FPO of 4.00 had sat in an
 * orphaned record since July, so she was shown a full descriptor band below
 * what her own data supported.
 *
 * The 7 skipped records still show no score, as intended - Catamin and
 * De La Cruz would each have been handed a "4.00 Outstanding" built from FPO
 * alone. Orphaned records were left untouched and still hold their values, so
 * every one of these changes is reversible.
 *
 * Side effect worth knowing: the recompute also replaced legacy descriptors
 * ("Excellent Alignment") with the current protocol bands. That label is not
 * produced anywhere in the present codebase - it is residue from an older
 * version, and other records may still carry it.
 *
 * This leaves 11 people who have ratings but NO FPO anywhere in the database.
 * They are scored on 45% of the intended weight. No migration can fix that -
 * the values have to be encoded by a person. See PMES_CHANGELOG_MEMORY.md.
 */

// No trailing underscore: these must stay visible in the Run dropdown.
function previewMergeOrphanedFpo() {
  return MigrationMergeOrphanedFpo_.run({ dryRun: true })
}

function migrateMergeOrphanedFpo() {
  return MigrationMergeOrphanedFpo_.run({ dryRun: false })
}

const MigrationMergeOrphanedFpo_ = (() => {

  function blank_(v) {
    return v === '' || v === null || v === undefined || !isFinite(Number(v))
  }

  // Mirrors IPATService.recordScore so this migration treats the same record as
  // canonical that the application displays. If that ranking ever changes, this
  // must change with it or the migration will enrich a record nobody reads.
  function rank_(record, assignments) {
    const linked = assignments.filter(a => String(a.ipatRecordId) === String(record.id))
    const completed = linked.filter(a => String(a.status) === 'Completed').length
    const hasScore = record.overallScore || record.cbcScore || record.jfScore || record.fpoScore ? 1 : 0
    const created = record.createdAt ? new Date(record.createdAt).getTime() : 0
    return (linked.length * 1000) + (completed * 100) + (hasScore * 10) - (created || 0) / 10000000000000
  }

  function run(options) {
    const dryRun = !!(options && options.dryRun)
    const recSheet = SpreadsheetService.getSheet(SHEET.IPAT_RECORDS)
    const records = SpreadsheetService.getAllRows(recSheet)
    let assignments = []
    try {
      assignments = SpreadsheetService.getAllRows(SpreadsheetService.getSheet(SHEET.IPAT_ASSIGNMENTS))
    } catch (e) {
      Logger.log('WARNING: assignments unreadable (' + e.message + '); ranking falls back to score/age only')
    }

    const groups = {}
    records.forEach(r => {
      if (!r.rateeId) return
      const key = [r.rateeId, r.semester, r.year].join('|')
      if (!groups[key]) groups[key] = []
      groups[key].push(r)
    })

    Logger.log(dryRun ? '=== PREVIEW - nothing written ===' : '=== MERGE - writing changes ===')
    let merged = 0
    let skippedAmbiguous = 0
    let skippedNoRatings = 0

    Object.keys(groups).forEach(key => {
      const rows = groups[key]
      if (rows.length < 2) return

      const canonical = rows.slice().sort((a, b) => rank_(b, assignments) - rank_(a, assignments))[0]
      if (!blank_(canonical.fpoScore)) return

      // Only restore a missing component to a record that already holds real
      // rating data. Without this the migration would MANUFACTURE a score for
      // people whose raters have not finished: their canonical record has no CBC
      // and no JF, so merging FPO alone would turn "In Progress" into a
      // confident "4.00 Outstanding" built from 55% of the weight. Showing no
      // score is more honest than showing one that is almost entirely absent.
      if (blank_(canonical.cbcScore) && blank_(canonical.jfScore)) {
        skippedNoRatings++
        Logger.log('  SKIPPED (no CBC or JF yet - would invent a score from FPO alone): ' +
          canonical.rateeName + ' S' + canonical.semester + ' ' + canonical.year)
        return
      }

      const donors = rows.filter(r => r.id !== canonical.id && !blank_(r.fpoScore))
      if (!donors.length) return
      if (donors.length > 1) {
        skippedAmbiguous++
        Logger.log('  SKIPPED (' + donors.length + ' competing FPO values, needs a human): ' +
          canonical.rateeName + ' S' + canonical.semester + ' ' + canonical.year)
        return
      }

      const donor = donors[0]
      const before = canonical.overallScore
      const updates = { fpoScore: donor.fpoScore }
      if (blank_(canonical.fpoWeightFactor) && !blank_(donor.fpoWeightFactor)) updates.fpoWeightFactor = donor.fpoWeightFactor
      if (!canonical.fpoPositionCategory && donor.fpoPositionCategory) updates.fpoPositionCategory = donor.fpoPositionCategory

      // Recompute through the app's own formula so rescaling of a 1-5 FPO,
      // weight renormalisation and any conduct deduction all behave identically.
      let after = '(not recomputed)'
      let descriptor = ''
      try {
        const computed = IPATService.calculateOverallForMigration(
          Object.keys(updates).reduce((acc, k) => { acc[k] = updates[k]; return acc },
            JSON.parse(JSON.stringify(canonical)))
        )
        after = computed.overallScore
        descriptor = computed.descriptor
        updates.overallScore = computed.overallScore
        updates.descriptor = computed.descriptor
        updates.status = 'Computed'
      } catch (e) {
        Logger.log('  WARNING: recompute failed for ' + canonical.rateeName + ': ' + e.message)
        return
      }

      merged++
      Logger.log('  ' + canonical.rateeName + ' S' + canonical.semester + ' ' + canonical.year +
        ' | FPO ' + donor.fpoScore + ' from orphan ' + donor.id +
        ' | overall ' + (before || '(none)') + ' -> ' + after + ' ' + descriptor)

      if (!dryRun) {
        updates.updatedAt = new Date().toISOString()
        SpreadsheetService.updateRow(recSheet, canonical.id, updates)
      }
    })

    Logger.log('TOTAL: ' + merged + (dryRun ? ' record(s) would be merged' : ' record(s) merged') +
      (skippedAmbiguous ? ', ' + skippedAmbiguous + ' skipped as ambiguous' : '') +
      (skippedNoRatings ? ', ' + skippedNoRatings + ' skipped with no CBC/JF yet' : ''))
    return { dryRun: dryRun, merged: merged, skippedAmbiguous: skippedAmbiguous, skippedNoRatings: skippedNoRatings }
  }

  return { run: run }
})()
