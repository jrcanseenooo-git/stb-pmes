const AssessmentRulesService = (() => {
  const SHEET_NAME = 'AssessmentRules'
  const HEADERS = [
    'id', 'officeId', 'ruleType', 'ruleKey', 'label', 'value',
    'active', 'description', 'createdAt', 'updatedAt', 'updatedBy'
  ]

  const DEFAULT_DOMAIN_WEIGHTS = { cbc: 0.30, fpo: 0.55, jf: 0.15 }
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

  function getDomainWeights() {
    return resolveWeights_('domainWeight', DEFAULT_DOMAIN_WEIGHTS)
  }

  function getCbcRaterWeights() {
    return resolveWeights_('cbcRaterWeight', DEFAULT_CBC_RATER_WEIGHTS)
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
      updatedAt: row.updatedAt || ''
    }
  }

  return {
    list,
    seedDefaults,
    update,
    getDomainWeights,
    getCbcRaterWeights,
    ensureDefaultsForSpreadsheet
  }
})()
