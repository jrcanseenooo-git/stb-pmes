/**
 * MidnightLogoutService.gs
 *
 * Forces every session left open overnight to re-login. A time-driven Apps
 * Script trigger fires at midnight (Asia/Manila) and stamps a cutoff
 * timestamp; AuthService.verifyToken() rejects any request whose ID token
 * was issued before that cutoff, regardless of the token's own expiry. A
 * user who signs in after the cutoff is unaffected - their fresh token's
 * iat is newer.
 *
 * SETUP (one-time, manual): open this project in the Apps Script editor,
 * select `installMidnightLogoutTrigger` from the function dropdown next to
 * Run, and run it once. It is idempotent - running it again just replaces
 * the existing trigger rather than creating duplicates. Confirm it's
 * installed under Triggers (clock icon) in the left sidebar.
 */

// ── Trigger handler - called by the installed time-driven trigger, not by any request ──
function runMidnightLogout() {
  try {
    const cutoff = SystemSettingsService.setLogoutCutoffToNow_()
    Logger.log('[MidnightLogout] Cutoff set to ' + cutoff + ' (' + new Date(cutoff * 1000).toISOString() + ')')
  } catch (e) {
    Logger.log('[MidnightLogout] Failed to set cutoff: ' + e.message)
  }
}

// ── One-time setup - run manually from the Apps Script editor ──
function installMidnightLogoutTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'runMidnightLogout')
    .forEach(t => ScriptApp.deleteTrigger(t))

  ScriptApp.newTrigger('runMidnightLogout')
    .timeBased()
    .atHour(0)
    .nearMinute(0)
    .everyDays(1)
    .inTimezone('Asia/Manila')
    .create()

  Logger.log('[MidnightLogout] Trigger installed - fires daily around 12:00 AM Asia/Manila.')
}
