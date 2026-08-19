/**
 * MigrationRenameSheets.gs
 * ─────────────────────────────────────────────────────────────────────────────
 * One-off migration: rename spreadsheet tabs to descriptive business names.
 *
 * SAFE TO RUN because SpreadsheetService.getSheet() already resolves BOTH the
 * old and the new name (see SHEET_NAME_FALLBACKS). The deployed application
 * keeps working before, during and after this migration - there is no window in
 * which the app is broken.
 *
 * HOW TO RUN
 *   Apps Script editor → select `previewSheetRename` → Run   (read-only preview)
 *   Apps Script editor → select `renameSheetsToCanonicalNames` → Run
 *
 * `previewSheetRename` changes nothing. Run it first and read the log.
 *
 * WHAT THE RENAME DOES
 *   1. Refuses to run if any target name is already taken by a different tab.
 *   2. Takes a full backup copy of the spreadsheet to Drive first.
 *   3. Renames each tab, skipping any that is already renamed or missing.
 *   4. Verifies every rename and logs a summary.
 *
 * ROLLBACK
 *   Run `rollbackSheetRename()` - it reverses the map. The backup copy created
 *   in step 2 is the belt-and-braces fallback.
 */

// Old tab name  ->  new descriptive name.
// Keep this identical to SHEET_NAME_FALLBACKS in SpreadsheetService.gs.
const SHEET_RENAME_MAP = {
  'IPATRecords':          'AssessmentRecords',
  'IPATCBCRatings':       'CompetencyBehaviorRatings',
  'IPATJFRatings':        'JobFitnessRatings',
  'IPATRaterAssignments': 'RaterAssignments',
  'MOVFiles':             'EvidenceFiles',
  'AuditLog':             'AuditLogs'
}

/** Read-only. Shows exactly what would change. Run this first. */
function previewSheetRename() {
  const ss = SpreadsheetApp.openById(
    PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID') ||
    '1lCJaa2ywDjlRHrltCDgpY-I_kCR5WxfBXwvIUVSRqrU'
  )
  const existing = ss.getSheets().map(s => s.getName())
  const lines = ['── PREVIEW - nothing has been changed ──', 'Tabs currently in the file: ' + existing.length, '']

  let toRename = 0, alreadyDone = 0, missing = 0, blocked = 0

  Object.keys(SHEET_RENAME_MAP).forEach(oldName => {
    const newName = SHEET_RENAME_MAP[oldName]
    const hasOld = existing.indexOf(oldName) >= 0
    const hasNew = existing.indexOf(newName) >= 0

    if (hasOld && hasNew) {
      lines.push('BLOCKED  ' + oldName + ' -> ' + newName + '   (BOTH exist - resolve manually)')
      blocked++
    } else if (hasOld) {
      const rows = Math.max(ss.getSheetByName(oldName).getLastRow() - 1, 0)
      lines.push('RENAME   ' + oldName + ' -> ' + newName + '   (' + rows + ' data rows)')
      toRename++
    } else if (hasNew) {
      lines.push('SKIP     ' + newName + '   (already renamed)')
      alreadyDone++
    } else {
      lines.push('MISSING  ' + oldName + '   (tab not in this file - nothing to do)')
      missing++
    }
  })

  lines.push('')
  lines.push('to rename: ' + toRename + ' | already done: ' + alreadyDone + ' | missing: ' + missing + ' | blocked: ' + blocked)
  if (blocked) lines.push('⚠ Resolve BLOCKED rows before running renameSheetsToCanonicalNames().')

  const out = lines.join('\n')
  Logger.log(out)
  try { SpreadsheetApp.getUi().alert('Sheet rename preview', out, SpreadsheetApp.getUi().ButtonSet.OK) } catch (e) {}
  return out
}

/** Performs the rename. Takes a backup copy first. */
function renameSheetsToCanonicalNames() {
  return _applySheetRename(SHEET_RENAME_MAP, 'rename')
}

/** Reverses the rename (new name -> old name). */
function rollbackSheetRename() {
  const reversed = {}
  Object.keys(SHEET_RENAME_MAP).forEach(k => { reversed[SHEET_RENAME_MAP[k]] = k })
  return _applySheetRename(reversed, 'rollback')
}

function _applySheetRename(map, mode) {
  const ssId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID') ||
               '1lCJaa2ywDjlRHrltCDgpY-I_kCR5WxfBXwvIUVSRqrU'
  const ss = SpreadsheetApp.openById(ssId)
  const nameOf = () => ss.getSheets().map(s => s.getName())

  // ── Pre-flight: refuse if any rename would collide with a different tab ──
  const existing = nameOf()
  const collisions = Object.keys(map).filter(o => existing.indexOf(o) >= 0 && existing.indexOf(map[o]) >= 0)
  if (collisions.length) {
    const msg = 'ABORTED - both old and new tabs exist for: ' + collisions.join(', ') +
                '. Resolve manually (the data is in one of each pair) before running this.'
    Logger.log(msg)
    try { SpreadsheetApp.getUi().alert('Rename aborted', msg, SpreadsheetApp.getUi().ButtonSet.OK) } catch (e) {}
    return msg
  }

  // ── Backup before touching anything ──
  let backupUrl = '(backup skipped)'
  try {
    const stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss')
    const backup = DriveApp.getFileById(ssId).makeCopy('PMES Database BACKUP before ' + mode + ' ' + stamp)
    backupUrl = backup.getUrl()
    Logger.log('Backup created: ' + backup.getName())
  } catch (e) {
    const msg = 'ABORTED - could not create a backup copy: ' + e.message +
                '. Refusing to rename production tabs without one.'
    Logger.log(msg)
    try { SpreadsheetApp.getUi().alert('Rename aborted', msg, SpreadsheetApp.getUi().ButtonSet.OK) } catch (e2) {}
    return msg
  }

  // ── Apply ──
  const done = [], skipped = [], failed = []
  Object.keys(map).forEach(oldName => {
    const newName = map[oldName]
    const sheet = ss.getSheetByName(oldName)
    if (!sheet) { skipped.push(oldName + ' (not present)'); return }
    try {
      const rows = Math.max(sheet.getLastRow() - 1, 0)
      sheet.setName(newName)
      done.push(oldName + ' -> ' + newName + ' (' + rows + ' rows)')
    } catch (e) {
      failed.push(oldName + ' -> ' + newName + ' : ' + e.message)
    }
  })

  SpreadsheetApp.flush()

  // ── Verify ──
  const after = nameOf()
  const unverified = done
    .map(d => d.split(' -> ')[1].split(' (')[0])
    .filter(n => after.indexOf(n) < 0)

  const summary = [
    '── SHEET ' + mode.toUpperCase() + ' COMPLETE ──',
    'Backup: ' + backupUrl,
    '',
    'Renamed (' + done.length + '):',
    done.length ? '  ' + done.join('\n  ') : '  none',
    '',
    'Skipped (' + skipped.length + '): ' + (skipped.join(', ') || 'none'),
    'Failed  (' + failed.length + '): ' + (failed.join('; ') || 'none'),
    unverified.length ? '⚠ NOT VERIFIED: ' + unverified.join(', ') : 'All renames verified in the live file.',
    '',
    'The app keeps working either way - SpreadsheetService resolves both names.'
  ].join('\n')

  Logger.log(summary)
  try { SpreadsheetApp.getUi().alert('Sheet ' + mode, summary, SpreadsheetApp.getUi().ButtonSet.OK) } catch (e) {}
  return summary
}
