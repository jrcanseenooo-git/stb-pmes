/**
 * RaterMatrixService.gs
 *
 * Per-office, per-role configuration of WHO rates WHOM.
 *
 * WHY THIS EXISTS
 * ---------------
 * Rater assignment used to branch on five hardcoded STB role strings:
 *
 *     if (isStaff(role))              ...   // 'Staff' | 'Technical Staff' | 'Administrative Staff'
 *     else if (isSectionHead(role))   ...   // 'Section Head'
 *     else if (isDivisionChief(role)) ...   // 'Division Chief'
 *     else if (isABD(role))           ...   // 'Assistant Bureau Director'
 *     else if (isDirector(role))      ...   // 'Bureau Director'
 *     if (!raterList.length) return         // ← silent skip
 *
 * Participating offices define their own role names through the Office Registry
 * (Configure Registration Options). Any role outside those five literals fell
 * through every branch, produced an empty rater list, and hit that bare
 * `return` — the person was skipped with no assignment, no error, no log entry
 * and nothing in the UI. They were simply never rated.
 *
 * This service moves that decision out of code and into data, so an office can
 * describe its own hierarchy without a deploy, and an unmapped role becomes a
 * reported exception instead of silence.
 *
 * WEIGHTS ARE DELIBERATELY NOT STORED HERE
 * ----------------------------------------
 * The protocol assigns weights per rater TYPE (Self 15%, Peer 15%, Subordinate
 * 15%, Immediate Supervisor 30%, Skip Supervisor 25%), not per role, and
 * AssessmentRules.cbcRaterWeight already holds them and is what IPATService
 * reads when scoring. Duplicating weights here would create two tables that can
 * silently disagree and produce wrong scores. This matrix answers only "who
 * rates whom"; scoring weight stays in AssessmentRules.
 */
const RaterMatrixService = (() => {

  const SHEET_NAME = 'RaterMatrix'

  const HEADERS = [
    'id', 'officeId', 'rateeRole', 'raterType', 'sourceRoles',
    'scope', 'fallbackScope', 'sequence', 'active',
    'createdAt', 'updatedAt', 'updatedBy'
  ]

  // Where to look for a candidate rater, relative to the ratee.
  //   self                    → the ratee themselves
  //   same-section            → same division AND same section
  //   same-division           → same division, any section
  //   office-wide             → anyone in the office
  //   same-section-preferred  → 70% chance same-section, else same-division.
  //                             Reproduces the original Peer2 behaviour, which
  //                             deliberately mixed in occasional cross-section
  //                             peers rather than always drawing from one pool.
  const SCOPES = ['self', 'same-section', 'same-division', 'office-wide', 'same-section-preferred']

  const VALID_RATER_TYPES = ['Self', 'Peer', 'Peer1', 'Peer2', 'Subordinate', 'Supervisor', 'SkipSupervisor']

  // The STB hierarchy, transcribed from the five functions this replaces.
  // Seeding this makes the switch behaviour-preserving for STB — the critical
  // safety property, since STB is live and mid-cycle.
  const STB_DEFAULT_MATRIX = [
    // Technical / Administrative staff
    { rateeRole: 'Technical Staff', raterType: 'Self',           sourceRoles: '',                          scope: 'self',                   fallbackScope: '' },
    { rateeRole: 'Technical Staff', raterType: 'Peer1',          sourceRoles: 'Staff,Technical Staff,Administrative Staff', scope: 'same-section', fallbackScope: 'same-division' },
    { rateeRole: 'Technical Staff', raterType: 'Peer2',          sourceRoles: 'Staff,Technical Staff,Administrative Staff', scope: 'same-section-preferred', fallbackScope: 'same-division' },
    { rateeRole: 'Technical Staff', raterType: 'Supervisor',     sourceRoles: 'Section Head',              scope: 'same-section',           fallbackScope: 'same-division' },
    { rateeRole: 'Technical Staff', raterType: 'SkipSupervisor', sourceRoles: 'Division Chief',            scope: 'same-division',          fallbackScope: '' },

    // Section Head
    { rateeRole: 'Section Head', raterType: 'Self',           sourceRoles: '',                             scope: 'self',          fallbackScope: '' },
    { rateeRole: 'Section Head', raterType: 'Peer',           sourceRoles: 'Section Head',                 scope: 'same-division', fallbackScope: '' },
    { rateeRole: 'Section Head', raterType: 'Subordinate',    sourceRoles: 'Staff,Technical Staff,Administrative Staff', scope: 'same-section', fallbackScope: 'same-division' },
    { rateeRole: 'Section Head', raterType: 'Supervisor',     sourceRoles: 'Division Chief',               scope: 'same-division', fallbackScope: '' },
    { rateeRole: 'Section Head', raterType: 'SkipSupervisor', sourceRoles: 'Assistant Bureau Director',    scope: 'office-wide',   fallbackScope: '' },

    // Division Chief
    { rateeRole: 'Division Chief', raterType: 'Self',           sourceRoles: '',                          scope: 'self',          fallbackScope: '' },
    { rateeRole: 'Division Chief', raterType: 'Peer',           sourceRoles: 'Division Chief',            scope: 'office-wide',   fallbackScope: '' },
    { rateeRole: 'Division Chief', raterType: 'Subordinate',    sourceRoles: 'Section Head',              scope: 'same-division', fallbackScope: '' },
    { rateeRole: 'Division Chief', raterType: 'Supervisor',     sourceRoles: 'Assistant Bureau Director', scope: 'office-wide',   fallbackScope: '' },
    { rateeRole: 'Division Chief', raterType: 'SkipSupervisor', sourceRoles: 'Bureau Director',           scope: 'office-wide',   fallbackScope: '' },

    // Assistant Bureau Director — no skip supervisor above them
    { rateeRole: 'Assistant Bureau Director', raterType: 'Self',        sourceRoles: '',                          scope: 'self',        fallbackScope: '' },
    { rateeRole: 'Assistant Bureau Director', raterType: 'Peer',        sourceRoles: 'Assistant Bureau Director', scope: 'office-wide', fallbackScope: '' },
    { rateeRole: 'Assistant Bureau Director', raterType: 'Subordinate', sourceRoles: 'Division Chief',            scope: 'office-wide', fallbackScope: '' },
    { rateeRole: 'Assistant Bureau Director', raterType: 'Supervisor',  sourceRoles: 'Bureau Director',           scope: 'office-wide', fallbackScope: '' },

    // Bureau Director — self and a subordinate view only
    { rateeRole: 'Bureau Director', raterType: 'Self',        sourceRoles: '',                          scope: 'self',        fallbackScope: '' },
    { rateeRole: 'Bureau Director', raterType: 'Subordinate', sourceRoles: 'Assistant Bureau Director', scope: 'office-wide', fallbackScope: '' }
  ]

  // Roles treated as equivalent to 'Technical Staff' when seeding, so the STB
  // defaults cover every staff variant without three duplicate blocks.
  const STAFF_ALIASES = ['Staff', 'Administrative Staff']

  // ── Sheet access ──────────────────────────────────────────────────────────

  function sheet_() {
    let s = SpreadsheetService.findSheet(SHEET_NAME)
    if (s) return s
    const ss = SpreadsheetService.getSpreadsheet()
    s = ss.insertSheet(SHEET_NAME)
    s.appendRow(HEADERS)
    s.setFrozenRows(1)
    return s
  }

  function rows_(officeId) {
    const all = SpreadsheetService.getAllRows(sheet_())
    const key = String(officeId || '').trim()
    return all
      .filter(r => (!key || String(r.officeId || '') === key))
      .filter(r => r.active !== false && String(r.active).toLowerCase() !== 'false')
      .sort((a, b) => (Number(a.sequence) || 0) - (Number(b.sequence) || 0))
  }

  // ── Public API ────────────────────────────────────────────────────────────

  function list(params, user) {
    const profile = AuthService.getProfile(user)
    requireView_(profile)
    const officeId = resolveOfficeId_(profile, params)
    const items = rows_(officeId)
    return {
      officeId: officeId,
      items: items,
      scopes: SCOPES,
      raterTypes: VALID_RATER_TYPES,
      isSeeded: items.length > 0
    }
  }

  /**
   * Replace the whole matrix for one office in a single call.
   * Whole-set replacement rather than per-row edits, because a rater matrix is
   * only meaningful as a complete set — a half-applied edit could leave a role
   * with no supervisor and silently under-rate everyone in it.
   */
  function save(body, user) {
    const profile = AuthService.getProfile(user)
    requireManage_(profile)
    const officeId = resolveOfficeId_(profile, body)
    if (!officeId) throw HttpError('An office must be resolved before saving a rater matrix.', 400)

    const incoming = Array.isArray(body.items) ? body.items : []
    const cleaned = incoming.map((item, index) => normalizeRow_(item, officeId, index))

    validateMatrix_(cleaned)

    const s = sheet_()
    SpreadsheetService.getAllRows(s)
      .filter(r => String(r.officeId || '') === officeId)
      .forEach(r => SpreadsheetService.hardDeleteRow(s, r.id))

    const now = new Date().toISOString()
    const by = profile.email || user.email || ''
    cleaned.forEach(row => {
      SpreadsheetService.appendRow(s, {
        ...row,
        createdAt: now,
        updatedAt: now,
        updatedBy: by
      })
    })

    audit_('SAVE_RATER_MATRIX', officeId, `Saved ${cleaned.length} rater matrix rows`, user)
    return list({ officeId: officeId }, user)
  }

  /** Write the STB hierarchy into an office that has no matrix yet. */
  function seedDefaults(body, user) {
    const profile = AuthService.getProfile(user)
    requireManage_(profile)
    const officeId = resolveOfficeId_(profile, body)
    if (!officeId) throw HttpError('An office must be resolved before seeding.', 400)

    const expanded = []
    STB_DEFAULT_MATRIX.forEach(row => expanded.push(row))
    // Mirror the Technical Staff block onto the other staff role names so a
    // roster using 'Staff' or 'Administrative Staff' is covered too.
    STAFF_ALIASES.forEach(alias => {
      STB_DEFAULT_MATRIX
        .filter(r => r.rateeRole === 'Technical Staff')
        .forEach(r => expanded.push({ ...r, rateeRole: alias }))
    })

    return save({ officeId: officeId, items: expanded }, user)
  }

  /**
   * Resolve the rater list for one ratee. Returns the same shape the previous
   * hardcoded functions returned, so the assignment engine is unchanged
   * downstream.
   *
   * @returns {{raters: Array, unmappedRole: boolean, missing: Array}}
   */
  function resolveRatersFor(ratee, allUsers, prevAssign, matrixRows, helpers) {
    const role = String(ratee.role || '').trim()
    const applicable = matrixRows.filter(r => String(r.rateeRole || '').trim() === role)

    if (!applicable.length) {
      return { raters: [], unmappedRole: true, missing: [] }
    }

    const raters = []
    const missing = []
    const excluded = [ratee.id]

    applicable.forEach(row => {
      const raterType = String(row.raterType || '').trim()

      if (String(row.scope) === 'self') {
        raters.push({ raterId: ratee.id, raterName: ratee.fullName, raterType: raterType })
        return
      }

      const pick = selectCandidate_(ratee, allUsers, row, excluded, prevAssign, raterType, helpers)
      if (pick) {
        raters.push({ raterId: pick.id, raterName: pick.fullName, raterType: raterType })
        excluded.push(pick.id)
      } else {
        missing.push(raterType)
      }
    })

    return { raters: raters, unmappedRole: false, missing: missing }
  }

  // ── Candidate selection ───────────────────────────────────────────────────

  function selectCandidate_(ratee, allUsers, row, excluded, prevAssign, raterType, helpers) {
    const sourceRoles = String(row.sourceRoles || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)

    const byRole = allUsers.filter(u =>
      excluded.indexOf(u.id) < 0 &&
      sourceRoles.indexOf(String(u.role || '').trim()) >= 0
    )

    const primary = poolForScope_(byRole, ratee, String(row.scope || 'office-wide'))
    const prevId = helpers && helpers.prevRaterId
      ? helpers.prevRaterId(prevAssign, ratee.id, raterType)
      : null

    let pick = helpers.selectRandom(primary, excluded, prevId)
    if (pick) return pick

    const fallback = String(row.fallbackScope || '')
    if (fallback) {
      const secondary = poolForScope_(byRole, ratee, fallback)
      pick = helpers.selectRandom(secondary, excluded, prevId)
      if (pick) return pick
    }

    return null
  }

  function poolForScope_(candidates, ratee, scope) {
    const div = String(ratee.divisionId || '')
    const sec = String(ratee.section || '').trim()

    if (scope === 'office-wide') return candidates
    if (scope === 'same-division') return candidates.filter(u => String(u.divisionId || '') === div)

    if (scope === 'same-section') {
      // With no section recorded, the whole division is the section — this
      // matches the original behaviour and avoids returning an empty pool for
      // rosters that never captured section data.
      if (!sec) return candidates.filter(u => String(u.divisionId || '') === div)
      return candidates.filter(u =>
        String(u.divisionId || '') === div && String(u.section || '').trim() === sec
      )
    }

    if (scope === 'same-section-preferred') {
      const sectionPool = poolForScope_(candidates, ratee, 'same-section')
      const divisionPool = candidates.filter(u => String(u.divisionId || '') === div)
      if (Math.random() < 0.70 && sectionPool.length) return sectionPool
      return divisionPool.length ? divisionPool : sectionPool
    }

    return candidates
  }

  // ── Validation / normalisation ────────────────────────────────────────────

  function normalizeRow_(item, officeId, index) {
    const rateeRole = String(item.rateeRole || '').trim()
    const raterType = String(item.raterType || '').trim()
    const scope = String(item.scope || 'office-wide').trim()

    if (!rateeRole) throw HttpError('Every rater matrix row needs a ratee role.', 400)
    if (VALID_RATER_TYPES.indexOf(raterType) < 0) {
      throw HttpError(`"${raterType}" is not a valid rater type.`, 400)
    }
    if (SCOPES.indexOf(scope) < 0) {
      throw HttpError(`"${scope}" is not a valid scope.`, 400)
    }

    const sourceRoles = String(item.sourceRoles || '').trim()
    if (scope !== 'self' && !sourceRoles) {
      throw HttpError(`${rateeRole} → ${raterType} needs at least one source role.`, 400)
    }

    return {
      id: item.id || SpreadsheetService.generateId('RMX-'),
      officeId: officeId,
      rateeRole: rateeRole,
      raterType: raterType,
      sourceRoles: sourceRoles,
      scope: scope,
      fallbackScope: String(item.fallbackScope || '').trim(),
      sequence: Number(item.sequence) || index + 1,
      active: true
    }
  }

  function validateMatrix_(rows) {
    const seen = {}
    rows.forEach(r => {
      const key = r.rateeRole + '::' + r.raterType
      if (seen[key]) {
        throw HttpError(`${r.rateeRole} has more than one "${r.raterType}" rater configured.`, 400)
      }
      seen[key] = true
    })

    // A role with no Self row is almost certainly a mistake — self-rating is in
    // every variant of the protocol — but it is not structurally invalid, so
    // this surfaces as a warning through coverage rather than a hard rejection.
  }

  // ── Coverage ──────────────────────────────────────────────────────────────

  /**
   * Report which roles on the current roster have no matrix entry. This is what
   * turns the old silent skip into something an administrator can see BEFORE
   * generating assignments rather than discovering it afterwards.
   */
  function coverage(params, user) {
    const profile = AuthService.getProfile(user)
    requireView_(profile)
    const officeId = resolveOfficeId_(profile, params)
    const matrix = rows_(officeId)
    const configuredRoles = {}
    matrix.forEach(r => { configuredRoles[String(r.rateeRole || '').trim()] = true })

    const users = SpreadsheetService.getAllRows(SpreadsheetService.getSheet(SHEET.USERS))
      .filter(u => u.active === true || String(u.active).toLowerCase() === 'true')

    const roleCounts = {}
    users.forEach(u => {
      const role = String(u.role || '').trim()
      if (!role || role === 'System Administrator') return
      roleCounts[role] = (roleCounts[role] || 0) + 1
    })

    const items = Object.keys(roleCounts).sort().map(role => ({
      role: role,
      personnel: roleCounts[role],
      configured: Boolean(configuredRoles[role]),
      raterTypes: matrix
        .filter(r => String(r.rateeRole || '').trim() === role)
        .map(r => r.raterType)
    }))

    return {
      officeId: officeId,
      items: items,
      unmappedRoles: items.filter(i => !i.configured).length,
      unmappedPersonnel: items.filter(i => !i.configured).reduce((s, i) => s + i.personnel, 0),
      generatedAt: new Date().toISOString()
    }
  }

  // ── Access control ────────────────────────────────────────────────────────

  function requireView_(profile) {
    const ok = AuthService.hasPermission(profile, 'generate_ipat_assignments') ||
      AuthService.hasPermission(profile, 'manage_office_registry') ||
      AuthService.hasPermission(profile, 'view_cluster_monitoring') ||
      AuthService.hasPermission(profile, 'manage_office_users') ||
      String(profile.systemScope || '') === 'OFFICE_ADMIN' ||
      String(profile.officeRole || '') === 'OFFICE_ADMIN'
    if (!ok) throw HttpError('Access denied to the rater matrix.', 403)
  }

  function requireManage_(profile) {
    const ok = AuthService.hasPermission(profile, 'generate_ipat_assignments') ||
      AuthService.hasPermission(profile, 'manage_office_registry') ||
      String(profile.systemScope || '') === 'OFFICE_ADMIN' ||
      String(profile.officeRole || '') === 'OFFICE_ADMIN'
    if (!ok) throw HttpError('Access denied. Assignment administration permission required.', 403)
  }

  function resolveOfficeId_(profile, params) {
    const explicit = String((params && (params.officeId || params.officeCode)) || '').trim()
    const central = AuthService.hasPermission(profile, 'manage_office_registry') ||
      AuthService.hasPermission(profile, 'view_cluster_monitoring')
    if (explicit && central) return explicit
    return String(profile.officeId || profile.officeCode || 'STB').trim() || 'STB'
  }

  function audit_(action, officeId, summary, user) {
    try {
      AuditService.log(action, 'Rater Matrix', summary + ' for ' + officeId, user)
    } catch (e) {
      Logger.log('[RaterMatrix] audit skipped: ' + e.message)
    }
  }

  return {
    list,
    save,
    seedDefaults,
    coverage,
    resolveRatersFor,
    SHEET_NAME,
    HEADERS,
    SCOPES,
    VALID_RATER_TYPES,
    STB_DEFAULT_MATRIX
  }
})()
