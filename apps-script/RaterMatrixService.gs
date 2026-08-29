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
 * `return` - the person was skipped with no assignment, no error, no log entry
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

  // Matrix roles identify distinct positions in an office hierarchy. Keep an
  // OIC-Division Chief separate from a permanent Division Chief: they have the
  // same supervisory authority, but may be different people leading different
  // divisions. RoleLabelService intentionally combines them for permissions;
  // that broader permission canonicalization must not be used as a matrix key.
  function matrixRole_(value) {
    const raw = String(value || '').replace(/[\u200B-\u200D\uFEFF]/g, '').trim()
    const key = raw.toLowerCase().replace(/[\s_-]+/g, ' ')
    if (key === 'oic dc' || key === 'oic division chief' ||
        key === 'officer in charge division chief') return 'OIC-Division Chief'
    if (key === 'staff' || key === 'technical staff') return 'Technical Staff'
    return raw
  }

  function matrixRoleList_(value) {
    const seen = {}
    return String(value || '')
      .split(/[,|]/)
      .map(matrixRole_)
      .filter(Boolean)
      .filter(role => {
        if (seen[role]) return false
        seen[role] = true
        return true
      })
      .join(',')
  }

  function functionalRole_(value) {
    return typeof RoleLabelService !== 'undefined'
      ? RoleLabelService.canonicalRole(matrixRole_(value))
      : matrixRole_(value)
  }

  // Prefer rules for the person's exact configured title. If an older office
  // matrix has only Division Chief rules, OIC-Division Chief can still inherit
  // those rules because both roles have the same function. Exact OIC rows never
  // combine with Division Chief rows, preventing duplicate Self/Peer tasks.
  function matrixRowsForRatee_(rows, role) {
    const exactRole = matrixRole_(role)
    const exact = rows.filter(row => matrixRole_(row.rateeRole) === exactRole)
    if (exact.length) return exact
    const functional = functionalRole_(exactRole)
    return rows.filter(row => functionalRole_(row.rateeRole) === functional)
  }

  function sourceRoleMatches_(configuredRoles, actualRole) {
    const actual = matrixRole_(actualRole)
    const actualFunction = functionalRole_(actual)
    return configuredRoles.some(configured => {
      const expected = matrixRole_(configured)
      return expected === actual || functionalRole_(expected) === actualFunction
    })
  }

  // The STB hierarchy, transcribed from the five functions this replaces.
  // Seeding this makes the switch behaviour-preserving for STB - the critical
  // safety property, since STB is live and mid-cycle.
  const STB_DEFAULT_MATRIX = [
    // Technical / Administrative staff
    { rateeRole: 'Technical Staff', raterType: 'Self',           sourceRoles: '',                          scope: 'self',                   fallbackScope: '' },
    { rateeRole: 'Technical Staff', raterType: 'Peer',           sourceRoles: 'Technical Staff,Administrative Staff', scope: 'same-section', fallbackScope: 'same-division' },
    { rateeRole: 'Technical Staff', raterType: 'Peer2',          sourceRoles: 'Technical Staff,Administrative Staff', scope: 'same-section-preferred', fallbackScope: 'same-division' },
    { rateeRole: 'Technical Staff', raterType: 'Supervisor',     sourceRoles: 'Section Head',              scope: 'same-section',           fallbackScope: 'same-division' },
    { rateeRole: 'Technical Staff', raterType: 'SkipSupervisor', sourceRoles: 'Division Chief',            scope: 'same-division',          fallbackScope: '' },

    // Section Head
    { rateeRole: 'Section Head', raterType: 'Self',           sourceRoles: '',                             scope: 'self',          fallbackScope: '' },
    { rateeRole: 'Section Head', raterType: 'Peer',           sourceRoles: 'Section Head',                 scope: 'same-division', fallbackScope: '' },
    { rateeRole: 'Section Head', raterType: 'Subordinate',    sourceRoles: 'Technical Staff,Administrative Staff', scope: 'same-section', fallbackScope: 'same-division' },
    { rateeRole: 'Section Head', raterType: 'Supervisor',     sourceRoles: 'Division Chief',               scope: 'same-division', fallbackScope: '' },
    { rateeRole: 'Section Head', raterType: 'SkipSupervisor', sourceRoles: 'Assistant Bureau Director',    scope: 'office-wide',   fallbackScope: '' },

    // Division Chief
    { rateeRole: 'Division Chief', raterType: 'Self',           sourceRoles: '',                          scope: 'self',          fallbackScope: '' },
    { rateeRole: 'Division Chief', raterType: 'Peer',           sourceRoles: 'Division Chief',            scope: 'office-wide',   fallbackScope: '' },
    { rateeRole: 'Division Chief', raterType: 'Subordinate',    sourceRoles: 'Section Head',              scope: 'same-division', fallbackScope: '' },
    { rateeRole: 'Division Chief', raterType: 'Supervisor',     sourceRoles: 'Assistant Bureau Director', scope: 'office-wide',   fallbackScope: '' },
    { rateeRole: 'Division Chief', raterType: 'SkipSupervisor', sourceRoles: 'Bureau Director',           scope: 'office-wide',   fallbackScope: '' },

    // Assistant Bureau Director - no skip supervisor above them
    { rateeRole: 'Assistant Bureau Director', raterType: 'Self',        sourceRoles: '',                          scope: 'self',        fallbackScope: '' },
    { rateeRole: 'Assistant Bureau Director', raterType: 'Peer',        sourceRoles: 'Assistant Bureau Director', scope: 'office-wide', fallbackScope: '' },
    { rateeRole: 'Assistant Bureau Director', raterType: 'Subordinate', sourceRoles: 'Division Chief',            scope: 'office-wide', fallbackScope: '' },
    { rateeRole: 'Assistant Bureau Director', raterType: 'Supervisor',  sourceRoles: 'Bureau Director',           scope: 'office-wide', fallbackScope: '' },

    // Bureau Director - self and a subordinate view only
    { rateeRole: 'Bureau Director', raterType: 'Self',        sourceRoles: '',                          scope: 'self',        fallbackScope: '' },
    { rateeRole: 'Bureau Director', raterType: 'Subordinate', sourceRoles: 'Assistant Bureau Director', scope: 'office-wide', fallbackScope: '' }
  ]

  // Roles treated as equivalent to 'Technical Staff' when seeding, so the STB
  // defaults cover every staff variant without three duplicate blocks.
  const STAFF_ALIASES = ['Administrative Staff']

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

  function rows_(officeId, user) {
    const all = SpreadsheetService.getAllRows(sheet_())
    const key = String(officeId || '').trim()
    // Match every known spelling of this office, not just the exact string the
    // caller resolved. A profile carrying 'WGP' must still find rows saved as
    // 'OFF-WALANG-GUTOM' (and vice versa), or the matrix looks empty purely
    // because of how the office id happened to be written.
    const keys = key ? officeLookupKeys_(officeId) : null
    const roles = validRoleSet_(officeId, user)
    const rows = all
      .filter(r => (!keys || keys[normalizeOfficeKey_(r.officeId)]))
      .filter(r => r.active !== false && String(r.active).toLowerCase() !== 'false')

    // Do not hide already-saved matrix rows just because the live Office
    // Structure lookup is temporarily unresolved. Reset/seed still requires
    // Office Structure roles, but display/edit must preserve database truth.
    const visible = hasRoleSet_(roles)
      ? rows.map(r => sanitizeForOfficeRoles_(r, roles)).filter(Boolean)
      : rows

    return visible
      .sort((a, b) => (Number(a.sequence) || 0) - (Number(b.sequence) || 0))
  }

  // ── Public API ────────────────────────────────────────────────────────────

  // The RaterMatrix table, OfficeOrgOptions and OfficeRegistry are all central
  // configuration. Every public entry point binds to the central database
  // explicitly rather than inheriting whatever spreadsheet the current request
  // happens to be scoped to - assignment generation, for example, runs inside
  // an office-scoped request but must still read the central matrix.
  // officePersonnelRows_ sets its own office override for the Personnel read,
  // which is the one genuinely per-office thing this service touches.
  function central_(work) {
    return SpreadsheetService.withCentralSpreadsheet(work)
  }

  function list(params, user) {
    return central_(() => {
      const profile = AuthService.getProfile(user)
      requireView_(profile)
      const officeId = resolveOfficeId_(profile, params)
      const items = rows_(officeId, user)
      return {
        officeId: officeId,
        items: items,
        scopes: SCOPES,
        raterTypes: VALID_RATER_TYPES,
        isSeeded: items.length > 0
      }
    })
  }

  /**
   * Replace the whole matrix for one office in a single call.
   * Whole-set replacement rather than per-row edits, because a rater matrix is
   * only meaningful as a complete set - a half-applied edit could leave a role
   * with no supervisor and silently under-rate everyone in it.
   */
  function save(body, user) {
    return central_(() => {
      const profile = AuthService.getProfile(user)
      requireManage_(profile)
      const officeId = resolveOfficeId_(profile, body)
      if (!officeId) throw HttpError('An office must be resolved before saving a rater matrix.', 400)

      const incoming = Array.isArray(body.items) ? body.items : []
      const roles = validRoleSet_(officeId, user)
      const normalized = incoming.map((item, index) => normalizeRow_(item, officeId, index))
      const cleaned = hasRoleSet_(roles)
        ? normalized.map(row => sanitizeForOfficeRoles_(row, roles)).filter(Boolean)
        : normalized

      validateMatrix_(cleaned)
      const savedRows = replaceRows_(officeId, cleaned, profile, user)
      syncOfficeMirror_(officeId, '', savedRows)

      audit_('SAVE_RATER_MATRIX', officeId, `Saved ${cleaned.length} rater matrix rows`, user)
      // The caller already has the validated, canonical rows. Returning them
      // directly avoids rereading the entire matrix immediately after writing
      // it; coverage is still refreshed separately because it depends on the
      // current office personnel roster.
      return {
        officeId: officeId,
        items: savedRows,
        scopes: SCOPES,
        raterTypes: VALID_RATER_TYPES,
        isSeeded: savedRows.length > 0
      }
    })
  }

  /** Write the STB hierarchy into an office that has no matrix yet. */
  function seedDefaults(body, user) {
    return central_(() => {
      const profile = AuthService.getProfile(user)
      requireManage_(profile)
      const officeId = resolveOfficeId_(profile, body)
      if (!officeId) throw HttpError('An office must be resolved before seeding.', 400)

      const expanded = isStbOffice_(officeId)
        ? stbDefaultRows_()
        : officeDefaultRows_(officeId, user)

      return save({ officeId: officeId, items: expanded }, user)
    })
  }

  /**
   * Keep an office workbook's RaterMatrix tab readable for administrators who
   * inspect the Google Sheet directly. The central PMES workbook remains the
   * source of truth; this is only a synchronized mirror.
   */
  function syncOfficeMirrorForRegistryRow(row, user, options) {
    return central_(() => {
      const profile = AuthService.getProfile(user)
      requireManage_(profile)
      const officeId = String((row && (row.officeId || row.officeCode)) || '').trim()
      if (!officeId || isStbOffice_(officeId)) return { skipped: true, reason: 'central-office' }

      let items = rows_(officeId, user)
      let seeded = false
      if (!items.length && (!options || options.seedIfEmpty !== false)) {
        try {
          const defaults = officeDefaultRows_(officeId, user)
          replaceRows_(officeId, defaults, profile, user)
          items = rows_(officeId, user)
          seeded = items.length > 0
        } catch (e) {
          Logger.log('[RaterMatrix] default seed skipped for ' + officeId + ': ' + (e && e.message || e))
        }
      }

      const mirrored = syncOfficeMirror_(officeId, String((row && row.spreadsheetId) || ''), items)
      return {
        officeId: officeId,
        seeded: seeded,
        mirrored: mirrored.rows,
        warning: mirrored.warning || ''
      }
    })
  }

  /**
   * Resolve the rater list for one ratee. Returns the same shape the previous
   * hardcoded functions returned, so the assignment engine is unchanged
   * downstream.
   *
   * @returns {{raters: Array, unmappedRole: boolean, missing: Array}}
   */
  function resolveRatersFor(ratee, allUsers, prevAssign, matrixRows, helpers) {
    const applicable = matrixRowsForRatee_(matrixRows, ratee.role)

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

  // Validates an existing assignment against the CURRENT approved roster and
  // matrix without selecting a new random rater. This is what lets Backfill
  // preserve legitimate work while replacing only out-of-scope assignments.
  function isAssignmentValid(ratee, assignment, allUsers, matrixRows) {
    const row = matrixRowsForRatee_(matrixRows, ratee.role).find(item =>
      String(item.raterType || '').trim() === String(assignment.raterType || '').trim()
    )
    if (!row) return false
    if (String(row.scope || '') === 'self') {
      return String(assignment.raterId || '') === String(ratee.id || '')
    }

    const sourceRoles = String(row.sourceRoles || '').split(',').map(s => s.trim()).filter(Boolean)
    const candidates = allUsers.filter(person =>
      String(person.id || '') !== String(ratee.id || '') &&
      isAuthorizedRaterScope_(person, ratee, assignment.raterType) &&
      sourceRoleMatches_(sourceRoles, person.role)
    )
    const configuredScope = String(row.scope || 'office-wide')
    const primary = configuredScope === 'same-section-preferred'
      ? candidates.filter(person => String(person.divisionId || '') === String(ratee.divisionId || ''))
      : poolForScope_(candidates, ratee, configuredScope)
    let allowed = primary
    if (!primary.length && String(row.fallbackScope || '')) {
      allowed = poolForScope_(candidates, ratee, String(row.fallbackScope))
    }
    return allowed.some(person => String(person.id || '') === String(assignment.raterId || ''))
  }

  // Return the currently eligible people for one configured rater slot.  The
  // generator uses this only to give a newly approved rater coverage during a
  // backfill; it does not broaden the matrix scope or bypass division/section
  // authorization.
  function eligibleRatersFor(ratee, allUsers, matrixRows, raterType) {
    const row = matrixRowsForRatee_(matrixRows, ratee.role).find(item =>
      String(item.raterType || '').trim() === String(raterType || '').trim()
    )
    if (!row) return []
    if (String(row.scope || '') === 'self') return [ratee]

    const sourceRoles = String(row.sourceRoles || '').split(',').map(s => s.trim()).filter(Boolean)
    const candidates = allUsers.filter(person =>
      String(person.id || '') !== String(ratee.id || '') &&
      isAuthorizedRaterScope_(person, ratee, raterType) &&
      sourceRoleMatches_(sourceRoles, person.role)
    )
    const primary = poolForScope_(candidates, ratee, String(row.scope || 'office-wide'))
    if (primary.length || !String(row.fallbackScope || '')) return primary
    return poolForScope_(candidates, ratee, String(row.fallbackScope || 'office-wide'))
  }

  // ── Candidate selection ───────────────────────────────────────────────────

  function selectCandidate_(ratee, allUsers, row, excluded, prevAssign, raterType, helpers) {
    const sourceRoles = String(row.sourceRoles || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)

    const byRole = allUsers.filter(u =>
      excluded.indexOf(u.id) < 0 &&
      isAuthorizedRaterScope_(u, ratee, raterType) &&
      sourceRoleMatches_(sourceRoles, u.role)
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

  function isAuthorizedRaterScope_(rater, ratee, raterType) {
    const role = typeof RoleLabelService !== 'undefined'
      ? RoleLabelService.canonicalRole(rater.role)
      : String(rater.role || '').trim()
    const sameDivision = String(rater.divisionId || '') === String(ratee.divisionId || '')
    const supervisory = ['Supervisor', 'SkipSupervisor'].indexOf(String(raterType || '')) >= 0
    if (!supervisory) return true
    if (role === 'Division Chief') return sameDivision
    if (role === 'Section Head') {
      return sameDivision && String(rater.section || '').trim() !== '' &&
        String(rater.section || '').trim() === String(ratee.section || '').trim()
    }
    return true
  }

  function poolForScope_(candidates, ratee, scope) {
    const div = String(ratee.divisionId || '')
    const sec = String(ratee.section || '').trim()

    if (scope === 'office-wide') return candidates
    if (scope === 'same-division') return candidates.filter(u => String(u.divisionId || '') === div)

    if (scope === 'same-section') {
      // With no section recorded, the whole division is the section - this
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
    const rateeRole = matrixRole_(item.rateeRole)
    const raterType = String(item.raterType || '').trim()
    const scope = String(item.scope || 'office-wide').trim()

    if (!rateeRole) throw HttpError('Every rater matrix row needs a ratee role.', 400)
    if (VALID_RATER_TYPES.indexOf(raterType) < 0) {
      throw HttpError(`"${raterType}" is not a valid rater type.`, 400)
    }
    if (SCOPES.indexOf(scope) < 0) {
      throw HttpError(`"${scope}" is not a valid scope.`, 400)
    }

    const sourceRoles = matrixRoleList_(item.sourceRoles || '')
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

    // Every role takes a Peer. The fourth slot is EITHER Subordinate - when the
    // role supervises people - OR Peer 2 standing in for it when the role
    // supervises nobody. They are substitutes, so the combinations below are the
    // ones that cannot be scored as the administrator intends.
    //
    // Note that Peer + Peer2 is CORRECT and must stay allowed: computeCBC reads
    // the plain Peer into the primary slot when Peer1 is absent, so the two
    // colleagues score 15% each exactly as the numbered pair would.
    const typesByRole = {}
    rows.forEach(r => {
      const type = String(r.raterType || '')
      if (!typesByRole[r.rateeRole]) typesByRole[r.rateeRole] = {}
      typesByRole[r.rateeRole][type] = true
    })
    Object.keys(typesByRole).forEach(role => {
      const t = typesByRole[role]

      // Both substitutes present. Once a Subordinate exists, computeCBC merges
      // every peer rating into one shared slot, so the Peer 2 colleague rates and
      // their answers are averaged away rather than counted in their own right.
      if (t.Subordinate && (t.Peer2 || t.Peer1)) {
        throw HttpError(
          `${role} has both Subordinate and Peer 2. They are substitutes - a role uses one or the other. ` +
          'Keep Subordinate if this role supervises people, or Peer 2 if it supervises nobody.', 400)
      }

      // All three peer labels. computeCBC prefers the numbered pair, so the plain
      // Peer's submitted answers are dropped from the score entirely - the
      // colleague rates and it never counts, with nothing downstream able to tell
      // an ignored rater from a missing one once the weights renormalise.
      if (t.Peer && t.Peer1 && t.Peer2) {
        throw HttpError(
          `${role} has Peer, Peer 1 and Peer 2. That is not three peers - one of the ratings would be left out ` +
          'of the score entirely. Keep Peer and Peer 2.', 400)
      }

      // Peer and Peer1 are the same slot under two names.
      if (t.Peer && t.Peer1) {
        throw HttpError(`${role} has both Peer and Peer 1, which are the same rater under different names. Remove one.`, 400)
      }
    })

    // A role with no Self row is almost certainly a mistake - self-rating is in
    // every variant of the protocol - but it is not structurally invalid, so
    // this surfaces as a warning through coverage rather than a hard rejection.
  }

  function replaceRows_(officeId, rows, profile, user) {
    const s = sheet_()
    // Clear by the same alias-aware key set the read path uses. Strict
    // equality here would leave rows stored under another spelling of the
    // same office (WGP vs OFF-WALANG-GUTOM) in place, so a save would
    // silently duplicate the matrix instead of replacing it.
    const officeKeys = officeLookupKeys_(officeId)
    const data = s.getDataRange().getValues()
    const headers = data[0] || []
    const officeColumn = headers.indexOf('officeId')
    const matchingRows = []
    if (officeColumn >= 0) {
      for (let index = 1; index < data.length; index += 1) {
        if (officeKeys[normalizeOfficeKey_(data[index][officeColumn])]) matchingRows.push(index + 1)
      }
    }

    // A matrix save replaces a whole office block. Delete contiguous matches
    // in descending batches so one save is a handful of Sheets operations,
    // rather than one full sheet read + delete operation per old rule.
    for (let index = matchingRows.length - 1; index >= 0;) {
      const end = matchingRows[index]
      let start = end
      while (index > 0 && matchingRows[index - 1] === start - 1) {
        start = matchingRows[index - 1]
        index -= 1
      }
      s.deleteRows(start, end - start + 1)
      index -= 1
    }
    if (matchingRows.length) SpreadsheetService.invalidateSheet(s)

    const now = new Date().toISOString()
    const by = (profile && profile.email) || (user && user.email) || ''
    const normalized = rows.map((row, index) => ({
      ...row,
      id: row.id || SpreadsheetService.generateId('RMX-'),
      officeId: officeId,
      sequence: Number(row.sequence) || index + 1,
      active: row.active === false || String(row.active).toLowerCase() === 'false' ? false : true,
      createdAt: row.createdAt || now,
      updatedAt: now,
      updatedBy: by
    }))
    SpreadsheetService.appendRows(s, normalized)
    return normalized
  }

  function syncOfficeMirror_(officeId, spreadsheetId, items) {
    if (isStbOffice_(officeId)) return { rows: 0, skipped: true }
    try {
      let ss = null
      const targetSpreadsheetId = spreadsheetId || spreadsheetIdForOffice_(officeId)
      if (targetSpreadsheetId) ss = SpreadsheetApp.openById(targetSpreadsheetId)
      if (!ss) return { rows: 0, warning: 'office spreadsheet not resolved' }

      return SpreadsheetService.withSpreadsheet(ss, () => {
        let mirror = SpreadsheetService.findSheet(SHEET_NAME)
        if (!mirror) mirror = ss.insertSheet(SHEET_NAME)
        resetMirrorSheet_(mirror)
        const rows = (items || []).map(row => {
          const out = {}
          HEADERS.forEach(header => { out[header] = row[header] === undefined || row[header] === null ? '' : row[header] })
          return out
        })
        SpreadsheetService.appendRows(mirror, rows)
        return { rows: rows.length }
      })
    } catch (e) {
      const message = e && e.message || e
      Logger.log('[RaterMatrix] office mirror sync skipped for ' + officeId + ': ' + message)
      return { rows: 0, warning: String(message || '') }
    }
  }

  function resetMirrorSheet_(sheet) {
    sheet.clear()
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS])
    sheet.getRange(1, 1, 1, HEADERS.length)
      .setBackground('#0D2137')
      .setFontColor('#FFFFFF')
      .setFontWeight('bold')
      .setFontSize(10)
    sheet.setFrozenRows(1)
    sheet.autoResizeColumns(1, HEADERS.length)
  }

  function spreadsheetIdForOffice_(officeId) {
    try {
      const keys = officeLookupKeys_(officeId)
      const registry = SpreadsheetService.findSheet(SHEET.OFFICE_REGISTRY || 'OfficeRegistry')
      if (!registry) return ''
      const row = SpreadsheetService.getAllRows(registry).find(item =>
        keys[normalizeOfficeKey_(item.officeId)] || keys[normalizeOfficeKey_(item.officeCode)]
      )
      const spreadsheetId = String((row && row.spreadsheetId) || '').trim()
      if (!spreadsheetId || spreadsheetId === 'CENTRAL_PMES') return ''
      return spreadsheetId
    } catch (e) {
      Logger.log('[RaterMatrix] office spreadsheet lookup failed for ' + officeId + ': ' + (e && e.message || e))
      return ''
    }
  }

  // ── Coverage ──────────────────────────────────────────────────────────────

  /**
   * Report which roles on the current roster have no matrix entry. This is what
   * turns the old silent skip into something an administrator can see BEFORE
   * generating assignments rather than discovering it afterwards.
   */
  function coverage(params, user) {
    return central_(() => coverageInner_(params, user))
  }

  function coverageInner_(params, user) {
    const profile = AuthService.getProfile(user)
    requireView_(profile)
    const officeId = resolveOfficeId_(profile, params)
    const matrix = rows_(officeId, user)
    const users = officePersonnelRows_(officeId, user)
      .filter(u => u.active === true || String(u.active).toLowerCase() === 'true')

    const roleCounts = {}
    users.forEach(u => {
      const role = matrixRole_(u.role)
      if (!role || role === 'System Administrator') return
      roleCounts[role] = (roleCounts[role] || 0) + 1
    })

    const items = Object.keys(roleCounts).sort().map(role => {
      const applicable = matrixRowsForRatee_(matrix, role)
      return {
        role: role,
        personnel: roleCounts[role],
        configured: applicable.length > 0,
        raterTypes: applicable.map(r => r.raterType)
      }
    })

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
      AuthService.hasPermission(profile, 'manage_office_rater_matrix') ||
      AuthService.hasPermission(profile, 'manage_office_registry') ||
      AuthService.hasPermission(profile, 'view_cluster_monitoring') ||
      AuthService.hasPermission(profile, 'manage_office_users') ||
      String(profile.officeRole || '') === 'OFFICE_ADMIN'
    if (!ok) throw HttpError('Access denied to the rater matrix.', 403)
  }

  function requireManage_(profile) {
    const ok = AuthService.hasPermission(profile, 'generate_ipat_assignments') ||
      AuthService.hasPermission(profile, 'manage_office_rater_matrix') ||
      AuthService.hasPermission(profile, 'manage_office_registry') ||
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

  function stbDefaultRows_() {
    const expanded = []
    STB_DEFAULT_MATRIX.forEach(row => expanded.push(row))
    STAFF_ALIASES.forEach(alias => {
      STB_DEFAULT_MATRIX
        .filter(r => r.rateeRole === 'Technical Staff')
        .forEach(r => expanded.push({ ...r, rateeRole: alias }))
    })
    return expanded
  }

  function officeDefaultRows_(officeId, user) {
    const roles = roleOrderForOffice_(officeId, user)
    if (!roles.length) {
      const keys = Object.keys(officeLookupKeys_(officeId)).join(', ')
      throw HttpError(
        'No office roles were found in Office Structure for office "' + String(officeId || '') +
        '". Checked keys: ' + keys + '. The Office Structure may be saved under a different office id.',
        409
      )
    }
    const rows = []
    roles.forEach((role, index) => {
      rows.push({ rateeRole: role, raterType: 'Self', sourceRoles: '', scope: 'self', fallbackScope: '' })

      const lowerRoles = roles.slice(0, index)
      const supervisorRole = roles[index + 1]

      // The peer arrangement follows from whether anyone sits below this role -
      // the same fact that decides the Subordinate row, and the same fact
      // generation later reads back as hasSubordinate.
      //
      // This used to emit a single 'Peer' for every role unconditionally, so the
      // LOWEST role in an office - Technical Staff or Admin Staff, the largest
      // group - was seeded with one peer and no subordinate. The protocol gives
      // that role two peers, because with no subordinate the subordinate's share
      // passes to a second peer. The score still computed (one peer carried the
      // whole share as peerLegacy), so nothing failed visibly; the office simply
      // collected one colleague's view where it should have had two, and every
      // new office started that way until someone noticed and fixed it by hand.
      //
      // STB's hand-written defaults above already model this correctly; this
      // generated set now matches them.
      rows.push({ rateeRole: role, raterType: 'Peer', sourceRoles: role, scope: 'office-wide', fallbackScope: '' })
      if (!lowerRoles.length) {
        // Nobody below this role, so Peer 2 stands in for the Subordinate that
        // the role below would otherwise have provided.
        rows.push({ rateeRole: role, raterType: 'Peer2', sourceRoles: role, scope: 'office-wide', fallbackScope: '' })
      }
      const skipSupervisorRole = roles[index + 2]
      if (lowerRoles.length) {
        rows.push({
          rateeRole: role,
          raterType: 'Subordinate',
          sourceRoles: lowerRoles.join(','),
          scope: 'office-wide',
          fallbackScope: ''
        })
      }
      if (supervisorRole) {
        rows.push({
          rateeRole: role,
          raterType: 'Supervisor',
          sourceRoles: supervisorRole,
          scope: 'office-wide',
          fallbackScope: ''
        })
      }
      if (skipSupervisorRole) {
        rows.push({
          rateeRole: role,
          raterType: 'SkipSupervisor',
          sourceRoles: skipSupervisorRole,
          scope: 'office-wide',
          fallbackScope: ''
        })
      }
    })
    return rows
  }

  function sanitizeForOfficeRoles_(row, roles) {
    if (!roles) return row
    const rateeRole = matrixRole_(row.rateeRole)
    if (!roles[rateeRole]) return null
    if (String(row.scope || '') === 'self') return row

    const sourceRoles = String(row.sourceRoles || '')
      .split(',')
      .map(matrixRole_)
      .filter(role => role && roles[role])
    if (!sourceRoles.length) return null
    return {
      ...row,
      sourceRoles: sourceRoles.join(',')
    }
  }

  function hasRoleSet_(roles) {
    return !!(roles && Object.keys(roles).length)
  }

  function validRoleSet_(officeId, user) {
    if (isStbOffice_(officeId)) return null
    const roles = roleOrderForOffice_(officeId, user)
    const set = {}
    roles.forEach(role => { set[role] = true })
    return set
  }

  function roleOrderForOffice_(officeId, user) {
    const seen = {}
    const roles = []
    function add(role) {
      const name = matrixRole_(role)
      if (!name || seen[name]) return
      seen[name] = true
      roles.push(name)
    }

    try {
      const options = OfficeRegistryService.registrationOrgOptions()
      const canonicalId = canonicalOfficeId_(officeId)
      ;[
        options[canonicalId],
        options[officeId],
        options[String(officeId || '').toUpperCase()],
        options[String(canonicalId || '').toUpperCase()]
      ].forEach(direct => {
        ;((direct && direct.requestedRoles) || []).forEach(add)
      })
    } catch (e) {
      Logger.log('[RaterMatrix] role options unavailable: ' + (e && e.message || e))
    }

    if (!roles.length) {
      try {
        const direct = OfficeRegistryService.orgOptions(officeId, user)
        ;((direct && direct.requestedRoles) || []).forEach(add)
      } catch (e) {
        Logger.log('[RaterMatrix] direct role options unavailable for ' + officeId + ': ' + (e && e.message || e))
      }
    }

    if (!roles.length) {
      try {
        const canonicalId = canonicalOfficeId_(officeId)
        const direct = OfficeRegistryService.orgOptions(canonicalId, user)
        ;((direct && direct.requestedRoles) || []).forEach(add)
      } catch (e) {
        Logger.log('[RaterMatrix] canonical role options unavailable for ' + officeId + ': ' + (e && e.message || e))
      }
    }

    if (!roles.length) {
      roleRowsForOffice_(officeId).forEach(row => add(row.name))
    }

    if (!roles.length) {
      matrixRolesForOffice_(officeId).forEach(add)
    }

    return roles
  }

  function roleRowsForOffice_(officeId) {
    try {
      const keys = officeLookupKeys_(officeId)
      const sheet = SpreadsheetService.getSheet(SHEET.OFFICE_ORG_OPTIONS || 'OfficeOrgOptions')
      return SpreadsheetService.getAllRows(sheet)
        .filter(row => keys[normalizeOfficeKey_(row.officeId)])
        .filter(row => String(row.optionType || '').trim().toLowerCase() === 'role')
        .filter(row => row.active !== false && String(row.active).toLowerCase() !== 'false')
        .sort((a, b) => Number(a.sequence || 0) - Number(b.sequence || 0) || String(a.name || '').localeCompare(String(b.name || '')))
    } catch (e) {
      Logger.log('[RaterMatrix] direct role row lookup failed for ' + officeId + ': ' + (e && e.message || e))
      return []
    }
  }

  function matrixRolesForOffice_(officeId) {
    try {
      const keys = officeLookupKeys_(officeId)
      const roles = []
      const seen = {}
      SpreadsheetService.getAllRows(sheet_())
        .filter(row => keys[normalizeOfficeKey_(row.officeId)])
        .filter(row => row.active !== false && String(row.active).toLowerCase() !== 'false')
        .sort((a, b) => Number(a.sequence || 0) - Number(b.sequence || 0))
        .forEach(row => {
          const role = matrixRole_(row.rateeRole)
          if (!role || seen[role]) return
          seen[role] = true
          roles.push(role)
        })
      return roles
    } catch (e) {
      Logger.log('[RaterMatrix] matrix role fallback failed for ' + officeId + ': ' + (e && e.message || e))
      return []
    }
  }

  function officeLookupKeys_(officeId) {
    const raw = String(officeId || '').trim()
    const canonical = canonicalOfficeId_(raw)
    const values = [raw, canonical]
    const key = normalizeOfficeKey_(raw)
    const canonicalKey = normalizeOfficeKey_(canonical)

    if (key === 'WGP' || key === 'WALANG-GUTOM' || key === 'WALANG GUTOM PROGRAM' || canonicalKey === 'OFF-WALANG-GUTOM') {
      values.push('WGP', 'OFF-WGP', 'WALANG-GUTOM', 'WALANG GUTOM PROGRAM', 'OFF-WALANG-GUTOM')
    }
    if (key === 'TBTP' || key === 'TARA-BASA' || key === 'TARA BASA TUTORING PROGRAM' || canonicalKey === 'OFF-TARA-BASA') {
      values.push('TBTP', 'OFF-TBTP', 'TARA-BASA', 'TARA BASA TUTORING PROGRAM', 'OFF-TARA-BASA')
    }
    if (raw && raw.indexOf('OFF-') !== 0) values.push('OFF-' + raw)

    const out = {}
    values.forEach(value => {
      const normalized = normalizeOfficeKey_(value)
      if (normalized) out[normalized] = true
    })
    return out
  }

  function normalizeOfficeKey_(value) {
    return String(value || '')
      .trim()
      .toUpperCase()
      .replace(/[!,.]/g, '')
      .replace(/\s+/g, ' ')
  }

  function canonicalOfficeId_(officeId) {
    const key = String(officeId || '').trim().toUpperCase()
    if (!key || key === 'STB') return 'STB'
    if (key === 'WGP' || key === 'WALANG-GUTOM' || key === 'WALANG GUTOM PROGRAM') return 'OFF-WALANG-GUTOM'
    if (key === 'TBTP' || key === 'TARA-BASA' || key === 'TARA BASA TUTORING PROGRAM') return 'OFF-TARA-BASA'
    if (key === 'PAG-ABOT') return 'OFF-PAG-ABOT'
    if (key === 'BANGUN') return 'OFF-BANGUN'
    if (key === 'EPAHP') return 'OFF-EPAHP'
    if (key === 'OUSI') return 'OFF-OUSI'
    return key
  }

  function officePersonnelRows_(officeId, user) {
    if (isStbOffice_(officeId)) {
      return SpreadsheetService.getAllRows(SpreadsheetService.getSheet(SHEET.USERS))
        .filter(u => isStbUser_(u))
    }
    try {
      const ss = OfficeRegistryService.getSpreadsheetForOffice(officeId, user)
      return SpreadsheetService.withSpreadsheet(ss, () => {
        return SpreadsheetService.getAllRows(SpreadsheetService.getSheet('Personnel'))
      })
    } catch (e) {
      Logger.log('[RaterMatrix] office personnel unavailable for ' + officeId + ': ' + (e && e.message || e))
      return []
    }
  }

  function isStbOffice_(officeId) {
    const key = String(officeId || '').trim().toUpperCase()
    return !key || key === 'STB' || key === 'SOCIAL TECHNOLOGY BUREAU'
  }

  function isStbUser_(user) {
    const key = String(user.officeId || user.officeCode || user.office || 'STB').trim().toUpperCase()
    return !key || key === 'STB' || key === 'SOCIAL TECHNOLOGY BUREAU'
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
    syncOfficeMirrorForRegistryRow,
    coverage,
    resolveRatersFor,
    isAssignmentValid,
    eligibleRatersFor,
    SHEET_NAME,
    HEADERS,
    SCOPES,
    VALID_RATER_TYPES,
    STB_DEFAULT_MATRIX
  }
})()
