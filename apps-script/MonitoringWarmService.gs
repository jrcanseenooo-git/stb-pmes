/**
 * MonitoringWarmService.gs
 *
 * Keeps the Cluster Assessment Overview fast.
 *
 * Building that dashboard opens every participating office's spreadsheet and
 * reads three tabs from each. With eight offices that is roughly 32 spreadsheet
 * operations - seconds of wall time - and whoever opened the page first paid
 * all of it while watching a spinner.
 *
 * A time-driven trigger rebuilds the cache on a schedule instead, so the cold
 * path is normally paid here rather than by a user. The per-office entries it
 * populates last 30 minutes, so even a cluster payload that ages out in between
 * is usually reassembled from cache without touching a spreadsheet.
 *
 * SETUP (one-time, manual): open this project in the Apps Script editor, choose
 * `installMonitoringWarmTrigger` from the function dropdown next to Run, and
 * run it once. It is idempotent - running it again replaces the existing
 * trigger rather than adding a duplicate. Confirm under Triggers (clock icon).
 *
 * This is an optimisation, not a dependency: with no trigger installed the
 * dashboard still works, it is just slower on a cold cache.
 */

// ── Trigger handler - called by the installed trigger, not by any request ──
function runMonitoringWarm() {
  const started = Date.now()
  try {
    // refresh:'1' bypasses both the cluster entry and the per-office entries,
    // so the warm pass genuinely re-reads rather than re-caching stale data.
    const result = OfficeRegistryService.computeMonitoring_({ refresh: '1' })
    Logger.log('[MonitoringWarm] Rebuilt ' + (result && result.total) + ' office summaries in ' +
      ((Date.now() - started) / 1000).toFixed(1) + 's')
  } catch (e) {
    Logger.log('[MonitoringWarm] Failed: ' + (e && e.message || e))
  }
}

// ── One-time setup - run manually from the Apps Script editor ──
function installMonitoringWarmTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'runMonitoringWarm')
    .forEach(t => ScriptApp.deleteTrigger(t))

  ScriptApp.newTrigger('runMonitoringWarm')
    .timeBased()
    .everyMinutes(10)
    .create()

  Logger.log('[MonitoringWarm] Trigger installed - rebuilding every 10 minutes.')
}

// ── Removal, should the schedule ever need turning off ──
function removeMonitoringWarmTrigger() {
  const removed = ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'runMonitoringWarm')
  removed.forEach(t => ScriptApp.deleteTrigger(t))
  Logger.log('[MonitoringWarm] Removed ' + removed.length + ' trigger(s).')
}
