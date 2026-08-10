const AssessmentRulesService = (() => {
  const SHEET_NAME = 'AssessmentRules'
  // `basis` and `approvedBy` exist because the protocol (section IV.D) allows an
  // office to adopt adjusted weight allocations only "provided that the three
  // domains remain represented and the basis for adjustment is clearly
  // documented". Without somewhere to record that justification the system
  // permits an undocumented deviation, which the protocol does not.
  // ensureSheet_() appends any missing header, so adding these migrates the
  // live sheet on next access rather than needing a manual column insert.
  const HEADERS = [
    'id', 'officeId', 'ruleType', 'ruleKey', 'label', 'value',
    'active', 'description', 'basis', 'approvedBy',
    'createdAt', 'updatedAt', 'updatedBy'
  ]

  // Domain weights must cover all three domains and total 1.0. A stray decimal
  // (0.55 typed as 0.055) would otherwise be accepted silently and skew every
  // score for that office until somebody noticed the numbers looked wrong.
  const REQUIRED_DOMAINS = ['cbc', 'fpo', 'jf']
  const WEIGHT_SUM_TOLERANCE = 0.001

  const DEFAULT_DOMAIN_WEIGHTS = { cbc: 0.30, fpo: 0.55, jf: 0.15 }
  // FPO position weight factors (protocol V.B.1, STB only).
  //
  // The protocol states a 22% weight differential between Salary Grade II and
  // III positions and 34% between III and IV, with ITO I categorised under
  // Position III. Those differentials govern how much each position's TARGETS
  // are weighted when performance commitments are set — they are applied inside
  // the IPCR/DPCR computation, not as a multiplier on the final numerical
  // rating that reaches this system.
  //
  // These factors therefore default to 1.00, i.e. no adjustment. The mechanism
  // is wired into the IPCRF sync path (and only that path) so it is ready when
  // the IPCRF/CCEF module is rolled out, but the exact formula has to be
  // confirmed before any non-1.00 value is set: multiplying an already
  // normalised 1–5 rating by 1.22 would push scores past the top of the scale
  // and silently corrupt every STB result.
  const DEFAULT_FPO_POSITION_WEIGHTS = {
    positionII: 1.00,
    positionIII: 1.00,
    positionIV: 1.00
  }

  const DEFAULT_CBC_RATER_WEIGHTS = {
    self: 0.15,
    supervisor: 0.30,
    skipSupervisor: 0.25,
    peerStaffPrimary: 0.15,
    peerStaffSecondary: 0.15,
    peerLegacy: 0.30,
    peerWithSubordinate: 0.15,
    subordinate: 0.15
  }

  function list(params, user) {
    AuthService.requirePermission(user, 'manage_assessment_content')
    const rows = readRows_()
    const type = String(params.ruleType || '').trim()
    const activeOnly = params.activeOnly === true || String(params.activeOnly || '').toLowerCase() === 'true'
    return rows
      .filter(r => !type || String(r.ruleType || '') === type)
      .filter(r => !activeOnly || isActive_(r))
      .map(safeRule_)
      .sort((a, b) => String(a.ruleType + ':' + a.ruleKey).localeCompare(String(b.ruleType + ':' + b.ruleKey)))
  }

  function seedDefaults(user) {
    AuthService.requirePermission(user, 'manage_assessment_content')
    const sheet = ensureSheet_()
    const rows = SpreadsheetService.getAllRows(sheet)
    const now = new Date().toISOString()
    const defaults = defaultRows_('', now, user)
    let created = 0
    defaults.forEach(row => {
      const exists = rows.some(r => String(r.ruleType) === row.ruleType && String(r.ruleKey) === row.ruleKey)
      if (!exists) {
        SpreadsheetService.appendRow(sheet, row)
        created += 1
      }
    })
    AuditService.log('SEED_ASSESSMENT_RULES', 'AssessmentRules', 'Seeded ' + created + ' default assessment rules', user)
    return { created, rules: list({}, user) }
  }

  function update(body, user) {
    AuthService.requirePermission(user, 'manage_assessment_content')
    const sheet = ensureSheet_()
    const now = new Date().toISOString()
    const rows = SpreadsheetService.getAllRows(sheet)
    const updates = Array.isArray(body.rules) ? body.rules : []

    // Validate the whole batch against the state it would produce BEFORE
    // writing anything. Validating row-by-row mid-write could leave an office
    // with, say, CBC updated and FPO not — weights summing to 0.75 and every
    // subsequent score silently wrong until the next edit.
    validateDomainWeightBatch_(rows, updates)

    const changed = []
    updates.forEach(item => {
      const ruleType = String(item.ruleType || '').trim()
      const ruleKey = String(item.ruleKey || '').trim()
      const value = Number(item.value)
      if (!ruleType || !ruleKey) throw HttpError('Rule type and key are required.', 400)
      if (!isFinite(value) || value < 0 || value > 1) throw HttpError('Rule value must be between 0 and 1.', 400)
      const existing = rows.find(r => String(r.ruleType) === ruleType && String(r.ruleKey) === ruleKey)
      if (existing) {
        changed.push(SpreadsheetService.updateRow(sheet, existing.id, {
          value,
          active: item.active === false || String(item.active).toLowerCase() === 'false' ? false : true,
          description: item.description || existing.description || '',
          basis: item.basis || existing.basis || '',
          approvedBy: item.approvedBy || existing.approvedBy || '',
          updatedAt: now,
          updatedBy: user.email || ''
        }))
      } else {
        const row = {
          id: SpreadsheetService.generateId('RULE-'),
          officeId: item.officeId || '',
          ruleType,
          ruleKey,
          label: item.label || ruleKey,
          value,
          active: true,
          description: item.description || '',
          basis: item.basis || '',
          approvedBy: item.approvedBy || '',
          createdAt: now,
          updatedAt: now,
          updatedBy: user.email || ''
        }
        SpreadsheetService.appendRow(sheet, row)
        changed.push(row)
      }
    })
    AuditService.log('UPDATE_ASSESSMENT_RULES', 'AssessmentRules', 'Updated ' + changed.length + ' assessment rules', user)
    return { updated: changed.length, rules: list({}, user) }
  }

  /**
   * Rejects a batch whose resulting domain weights would be incomplete, out of
   * range, not total 1.0, or deviate from the protocol default without a
   * documented basis.
   *
   * Only runs when the batch actually touches domainWeight rows — editing rater
   * weights alone should not require restating the domain split.
   */
  function validateDomainWeightBatch_(existingRows, updates) {
    const touchesDomains = updates.some(u => String(u.ruleType || '').trim() === 'domainWeight')
    if (!touchesDomains) return

    // Start from what is stored, then lay the incoming batch over it.
    const resolved = {}
    const basisByKey = {}
    existingRows
      .filter(r => String(r.ruleType || '') === 'domainWeight' && isActive_(r))
      .forEach(r => {
        resolved[r.ruleKey] = Number(r.value)
        basisByKey[r.ruleKey] = r.basis || ''
      })

    updates
      .filter(u => String(u.ruleType || '').trim() === 'domainWeight')
      .forEach(u => {
        const key = String(u.ruleKey || '').trim()
        const isDeactivating = u.active === false || String(u.active).toLowerCase() === 'false'
        if (isDeactivating) {
          delete resolved[key]
          return
        }
        resolved[key] = Number(u.value)
        if (u.basis !== undefined) basisByKey[key] = u.basis || ''
      })

    const missing = REQUIRED_DOMAINS.filter(d => !(d in resolved))
    if (missing.length) {
      throw HttpError(
        'All three assessment domains must remain represented. Missing: ' +
        missing.map(d => d.toUpperCase()).join(', ') + '.',
        400
      )
    }

    const unknown = Object.keys(resolved).filter(k => REQUIRED_DOMAINS.indexOf(k) < 0)
    if (unknown.length) {
      throw HttpError('Unrecognised assessment domain(s): ' + unknown.join(', ') + '.', 400)
    }

    REQUIRED_DOMAINS.forEach(d => {
      const v = resolved[d]
      if (!isFinite(v) || v <= 0 || v >= 1) {
        throw HttpError(
          `${d.toUpperCase()} weight must be greater than 0 and less than 1 (received ${v}).`,
          400
        )
      }
    })

    const sum = REQUIRED_DOMAINS.reduce((s, d) => s + resolved[d], 0)
    if (Math.abs(sum - 1) > WEIGHT_SUM_TOLERANCE) {
      throw HttpError(
        'Assessment domain weights must total 100%. They currently total ' +
        Math.round(sum * 10000) / 100 + '% ' +
        `(CBC ${pct_(resolved.cbc)}, FPO ${pct_(resolved.fpo)}, JF ${pct_(resolved.jf)}).`,
        400
      )
    }

    // Protocol IV.D: a deviation from the standard split is permitted, but the
    // basis for it has to be documented.
    const deviates = REQUIRED_DOMAINS.some(
      d => Math.abs(resolved[d] - DEFAULT_DOMAIN_WEIGHTS[d]) > WEIGHT_SUM_TOLERANCE
    )
    if (deviates) {
      const documented = REQUIRED_DOMAINS.some(d => String(basisByKey[d] || '').trim())
      if (!documented) {
        throw HttpError(
          'These weights differ from the standard 30% / 55% / 15% allocation. ' +
          'Record the basis for the adjustment before saving.',
          400
        )
      }
    }
  }

  function pct_(v) {
    return Math.round(Number(v) * 10000) / 100 + '%'
  }

  function getDomainWeights() {
    return resolveWeights_('domainWeight', DEFAULT_DOMAIN_WEIGHTS)
  }

  function getCbcRaterWeights() {
    return resolveWeights_('cbcRaterWeight', DEFAULT_CBC_RATER_WEIGHTS)
  }

  function getFpoPositionWeights() {
    return resolveWeights_('fpoPositionWeight', DEFAULT_FPO_POSITION_WEIGHTS)
  }

  /**
   * Maps a position title / level onto a protocol weight category.
   * Protocol V.B.1: SWO, PDO and IO positions II, III and IV, with ITO I
   * categorised under Position III for its comparable operational complexity.
   */
  function resolvePositionCategory(positionText) {
    const text = String(positionText || '').trim().toUpperCase()
    if (!text) return ''

    // ITO I is explicitly categorised under Position III. Matched before the
    // generic numeral rules, and accepts both the abbreviation and the spelled
    // out title because rosters use either. `\b(I|1)\b` cannot match the "I" in
    // "III" — the following character is a word character, so the boundary
    // fails — which keeps ITO III out of this branch.
    if (/\b(ITO|INFORMATION\s+TECHNOLOGY\s+OFFICER)\s*(I|1)\b/.test(text)) return 'positionIII'

    if (/\b(IV|4)\b/.test(text)) return 'positionIV'
    if (/\b(III|3)\b/.test(text)) return 'positionIII'
    if (/\b(II|2)\b/.test(text)) return 'positionII'
    return ''
  }

  function ensureDefaultsForSpreadsheet(ss, office, user) {
    return SpreadsheetService.withSpreadsheet(ss, () => {
      const sheet = ensureSheet_()
      if (SpreadsheetService.getAllRows(sheet).length) return { created: 0 }
      const now = new Date().toISOString()
      defaultRows_(office && office.officeId || '', now, user).forEach(row => SpreadsheetService.appendRow(sheet, row))
      return { created: defaultRows_('', now, user).length }
    })
  }

  function resolveWeights_(ruleType, defaults) {
    const resolved = { ...defaults }
    try {
      readRows_()
        .filter(r => String(r.ruleType || '') === ruleType && isActive_(r))
        .forEach(r => {
          const value = Number(r.value)
          if (Object.prototype.hasOwnProperty.call(resolved, r.ruleKey) && isFinite(value) && value >= 0) {
            resolved[r.ruleKey] = value
          }
        })
    } catch (e) {
      Logger.log('[AssessmentRules] using default ' + ruleType + ' values: ' + (e && e.message || e))
    }
    return resolved
  }

  function readRows_() {
    return SpreadsheetService.getAllRows(ensureSheet_())
  }

  function ensureSheet_() {
    const ss = SpreadsheetService.getSpreadsheet()
    let sheet = ss.getSheetByName(SHEET_NAME)
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME)
      sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS])
      sheet.setFrozenRows(1)
    } else {
      const existing = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0].filter(Boolean)
      const missing = HEADERS.filter(h => existing.indexOf(h) < 0)
      if (missing.length) sheet.getRange(1, existing.length + 1, 1, missing.length).setValues([missing])
    }
    return sheet
  }

  function defaultRows_(officeId, now, user) {
    const rows = []
    Object.keys(DEFAULT_DOMAIN_WEIGHTS).forEach(key => rows.push({
      id: 'RULE-domain-' + key,
      officeId,
      ruleType: 'domainWeight',
      ruleKey: key,
      label: key.toUpperCase() + ' overall weight',
      value: DEFAULT_DOMAIN_WEIGHTS[key],
      active: true,
      description: 'Default STB PMES overall component weight.',
      basis: 'Innovations Unified Performance Assessment Tool, section IV.D standard allocation.',
      approvedBy: '',
      createdAt: now,
      updatedAt: now,
      updatedBy: user && user.email || ''
    }))
    Object.keys(DEFAULT_FPO_POSITION_WEIGHTS).forEach(key => rows.push({
      id: 'RULE-fpo-position-' + key,
      officeId,
      ruleType: 'fpoPositionWeight',
      ruleKey: key,
      label: key.replace('position', 'Position ') + ' FPO weight factor',
      value: DEFAULT_FPO_POSITION_WEIGHTS[key],
      active: true,
      description: 'Protocol V.B.1 position weight category. 1.00 = no adjustment; confirm the formula before changing.',
      basis: 'Innovations Unified Performance Assessment Tool, section V.B.1.',
      approvedBy: '',
      createdAt: now,
      updatedAt: now,
      updatedBy: user && user.email || ''
    }))
    Object.keys(DEFAULT_CBC_RATER_WEIGHTS).forEach(key => rows.push({
      id: 'RULE-cbc-rater-' + key,
      officeId,
      ruleType: 'cbcRaterWeight',
      ruleKey: key,
      label: key,
      value: DEFAULT_CBC_RATER_WEIGHTS[key],
      active: true,
      description: 'Default STB PMES competency behavior rater weight.',
      createdAt: now,
      updatedAt: now,
      updatedBy: user && user.email || ''
    }))
    return rows
  }

  function isActive_(row) {
    return row.active !== false && String(row.active).toLowerCase() !== 'false'
  }

  function safeRule_(row) {
    return {
      id: row.id,
      officeId: row.officeId || '',
      ruleType: row.ruleType || '',
      ruleKey: row.ruleKey || '',
      label: row.label || row.ruleKey || '',
      value: Number(row.value),
      active: isActive_(row),
      description: row.description || '',
      basis: row.basis || '',
      approvedBy: row.approvedBy || '',
      updatedAt: row.updatedAt || ''
    }
  }

  return {
    list,
    seedDefaults,
    getFpoPositionWeights,
    resolvePositionCategory,
    update,
    getDomainWeights,
    getCbcRaterWeights,
    ensureDefaultsForSpreadsheet
  }
})()
