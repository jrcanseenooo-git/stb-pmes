const AssessmentContentService = (() => {
  const SUPPORTED_LEVELS = ['Technical Staff', 'Section Head', 'Division Chief']
  const CBC_RATERS = ['Self', 'Peer', 'Upward', 'Supervisor', 'Skip Supervisor']
  const JF_RATERS = ['Self', 'Supervisor']
  const SEED_TEMPLATE_SHEET = 'AssessmentSeedTemplate'

  function sheetName_() { return (typeof SHEET !== 'undefined' && SHEET.ASSESSMENT_CONTENT) || 'AssessmentContent' }
  const HEADERS = [
    'id', 'domain', 'category', 'questionText', 'guidanceText', 'sequence',
    'scaleType', 'required', 'evidenceRequired',
    'applicableRaters', 'applicableLevels',
    'status', 'period', 'version', 'hasBeenUsed', 'changeNotes',
    'createdBy', 'createdByName', 'createdAt', 'updatedAt', 'archivedAt'
  ]

  function list(params, user) {
    AuthService.getProfile(user)
    let rows = SpreadsheetService.getAllRows(getSheet()).map(fromRow)

    if (params.domain) rows = rows.filter(r => String(r.domain).toLowerCase() === String(params.domain).toLowerCase())
    if (params.category) rows = rows.filter(r => r.category === params.category)
    if (params.status) rows = rows.filter(r => String(r.status).toLowerCase() === String(params.status).toLowerCase())
    if (params.period) rows = rows.filter(r => r.period === params.period)
    if (params.search) {
      const q = String(params.search).toLowerCase()
      rows = rows.filter(r =>
        String(r.questionText || '').toLowerCase().indexOf(q) >= 0 ||
        String(r.guidanceText || '').toLowerCase().indexOf(q) >= 0
      )
    }

    rows.sort((a, b) =>
      String(a.domain).localeCompare(String(b.domain)) ||
      String(a.category).localeCompare(String(b.category)) ||
      (Number(a.sequence) || 0) - (Number(b.sequence) || 0)
    )
    return SpreadsheetService.paginate(rows, params.page, params.pageSize || 500)
  }

  function get(id, user) {
    requireManager(user)
    const row = SpreadsheetService.getRow(getSheet(), id)
    if (!row) throw HttpError('Assessment question not found', 404)
    return fromRow(row)
  }

  function create(body, user) {
    const profile = requireManager(user)
    const now = new Date().toISOString()
    const entry = toRow({
      ...body,
      id: SpreadsheetService.generateId('AC-'),
      status: body.status || 'Draft',
      version: Number(body.version) || 1,
      hasBeenUsed: false,
      createdBy: profile.id,
      createdByName: profile.fullName || profile.email,
      createdAt: now,
      updatedAt: now,
      archivedAt: ''
    })
    validate(entry)
    SpreadsheetService.appendRow(getSheet(), entry)
    syncSeedTemplateAfterMutation_(entry, profile)
    AuditService.log('CREATE', 'AssessmentContent', 'Created assessment question ' + entry.id, user)
    return fromRow(entry)
  }

  function update(id, body, user) {
    const profile = requireManager(user)
    const sheet = getSheet()
    const current = SpreadsheetService.getRow(sheet, id)
    if (!current) throw HttpError('Assessment question not found', 404)
    if (isUsedActive(current)) {
      throw HttpError('This active question has already been used. Create a new version instead.', 409)
    }

    const updates = toRow({
      ...body,
      id,
      createdAt: current.createdAt,
      createdBy: current.createdBy,
      createdByName: current.createdByName,
      hasBeenUsed: current.hasBeenUsed === true || current.hasBeenUsed === 'TRUE',
      updatedAt: new Date().toISOString()
    })
    validate(updates)
    const updated = SpreadsheetService.updateRow(sheet, id, updates)
    syncSeedTemplateAfterMutation_(updated, profile)
    AuditService.log('UPDATE', 'AssessmentContent', 'Updated assessment question ' + id, user)
    return fromRow(updated)
  }

  function publish(id, body, user) {
    const profile = requireManager(user)
    const sheet = getSheet()
    const current = SpreadsheetService.getRow(sheet, id)
    if (!current) throw HttpError('Assessment question not found', 404)
    if (isUsedActive(current)) {
      throw HttpError('This active question has already been used. Create a new version instead.', 409)
    }
    const merged = toRow({
      ...current,
      ...body,
      id,
      status: 'Active',
      updatedAt: new Date().toISOString(),
      archivedAt: ''
    })
    validate(merged)
    const updated = SpreadsheetService.updateRow(sheet, id, merged)
    syncSeedTemplateAfterMutation_(updated, profile)
    AuditService.log('PUBLISH', 'AssessmentContent', 'Published assessment question ' + id, user)
    return fromRow(updated)
  }

  function archive(id, user) {
    requireManager(user)
    const updates = { status: 'Archived', archivedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    const updated = SpreadsheetService.updateRow(getSheet(), id, updates)
    removeSeedTemplateRow_(id)
    AuditService.log('ARCHIVE', 'AssessmentContent', 'Archived assessment question ' + id, user)
    return fromRow(updated)
  }

  function duplicateVersion(id, body, user) {
    const original = get(id, user)
    return create({
      ...original,
      ...body,
      id: undefined,
      status: 'Draft',
      version: Number(body.version || original.version || 1),
      hasBeenUsed: false
    }, user)
  }

  function reorder(body, user) {
    requireManager(user)
    let rows = parseJson(body.rows, body.rows || [])
    if (!Array.isArray(rows)) rows = []
    const sheet = getSheet()
    rows.forEach((item, index) => {
      if (item && item.id) {
        try {
          SpreadsheetService.updateRow(sheet, item.id, {
            sequence: Number(item.sequence || index + 1),
            updatedAt: new Date().toISOString()
          })
        } catch (e) {
          Logger.log('[AssessmentContent] reorder skipped id=' + item.id + ': ' + e.message)
        }
      }
    })
    AuditService.log('REORDER', 'AssessmentContent', 'Reordered ' + rows.length + ' assessment questions', user)
    return { updated: rows.length }
  }

  function promoteSeedTemplate(body, user) {
    const profile = requireManager(user)
    const sourceRows = SpreadsheetService.getAllRows(getSheet())
      .map(fromRow)
      .filter(row => String(row.status || '') === 'Active')
      .sort(questionSort_)

    if (!sourceRows.length) {
      throw HttpError('No active assessment questions are available to promote as the seed template.', 400)
    }

    const now = new Date().toISOString()
    const templateRows = sourceRows.map((row, index) => toRow({
      ...row,
      id: row.id,
      hasBeenUsed: false,
      createdBy: profile.id,
      createdByName: profile.fullName || profile.email,
      createdAt: now,
      updatedAt: now,
      archivedAt: '',
      changeNotes: row.changeNotes || 'Promoted from active assessment content'
    }))

    replaceSheetRows_(getSeedTemplateSheet_(), templateRows)
    AuditService.log('PROMOTE_SEED_TEMPLATE', 'AssessmentContent', 'Promoted ' + templateRows.length + ' active questions as the assessment seed template', user)
    return { count: templateRows.length, source: 'active-assessment-content' }
  }

  // ── Seed from promoted template first, with hardcoded HEARTWORK + JF fallback ──
  function seed(body, user) {
    requireManager(user)
    const sheet = getSheet()
    const existing = SpreadsheetService.getAllRows(sheet)
    if (existing.length > 0 && !body.force) {
      throw HttpError('Assessment content already seeded (' + existing.length + ' questions). Pass force:true to reseed.', 409)
    }

    if (existing.length > 0 && body.force) {
      clearDataRows_(sheet)
    }

    const now = new Date().toISOString()
    const templateRows = getSeedTemplateRows_()
    if (templateRows.length) {
      const entries = templateRows.map(row => toRow({
        ...row,
        id: SpreadsheetService.generateId('AC-'),
        hasBeenUsed: false,
        createdBy: 'seed-template',
        createdByName: 'Assessment Seed Template',
        createdAt: now,
        updatedAt: now,
        archivedAt: ''
      }))
      appendRows_(sheet, entries)
      AuditService.log('SEED', 'AssessmentContent', 'Seeded ' + entries.length + ' assessment questions from the promoted seed template', user)
      return { seeded: entries.length, source: 'seed-template', cbcCount: entries.filter(r => r.domain === 'cbc').length, jfCount: entries.filter(r => r.domain === 'jf').length }
    }

    const themes = IPATService.getThemes()
    const jfIndicators = IPATService.getJFIndicators()
    const entries = []

    // JF category IDs must match the frontend assessmentDomains definition
    var JF_CATEGORY_MAP = [
      'educational-fit',
      'experience-alignment',
      'training-skills',
      'organizational-objectives',
      'attendance-punctuality'
    ]

    themes.forEach(theme => {
      theme.indicators.forEach((indicator, idx) => {
        var entry = toRow({
          id: SpreadsheetService.generateId('AC-'),
          domain: 'cbc',
          category: theme.id,
          questionText: indicator,
          guidanceText: theme.description,
          sequence: idx + 1,
          scaleType: '1-4 Likert',
          required: true,
          evidenceRequired: false,
          applicableRaters: JSON.stringify(CBC_RATERS),
          applicableLevels: JSON.stringify([]),
          status: 'Active',
          period: '',
          version: 1,
          hasBeenUsed: false,
          changeNotes: 'Seeded from HEARTWORK competency themes',
          createdBy: 'system',
          createdByName: 'System Seed',
          createdAt: now,
          updatedAt: now,
          archivedAt: ''
        })
        entries.push(entry)
      })
    })

    jfIndicators.forEach((item, idx) => {
      var indicatorText = typeof item === 'string' ? item : item.label || item
      var entry = toRow({
        id: SpreadsheetService.generateId('AC-'),
        domain: 'jf',
        category: JF_CATEGORY_MAP[idx] || 'job-fitness',
        questionText: indicatorText,
        guidanceText: 'Rate job fitness indicators and optional supporting evidence.',
        sequence: 1,
        scaleType: '1-4 Likert',
        required: true,
        evidenceRequired: true,
        applicableRaters: JSON.stringify(['Self', 'Supervisor']),
        applicableLevels: JSON.stringify([]),
        status: 'Active',
        period: '',
        version: 1,
        hasBeenUsed: false,
        changeNotes: 'Seeded from Job Fitness indicators',
        createdBy: 'system',
        createdByName: 'System Seed',
        createdAt: now,
        updatedAt: now,
        archivedAt: ''
      })
      entries.push(entry)
    })

    appendRows_(sheet, entries)
    AuditService.log('SEED', 'AssessmentContent', 'Seeded ' + entries.length + ' assessment questions from HEARTWORK + JF indicators', user)
    return { seeded: entries.length, source: 'built-in', cbcCount: themes.reduce((s, t) => s + t.indicators.length, 0), jfCount: jfIndicators.length }
  }

  // ── Lock check: block mutations when evaluations are in progress ──
  function getSheet() {
    try {
      return SpreadsheetService.getSheet(sheetName_())
    } catch (e) {
      const ss = SpreadsheetService.getSpreadsheet()
      const sheet = ss.insertSheet(sheetName_())
      sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS])
      sheet.getRange(1, 1, 1, HEADERS.length)
        .setBackground('#0D2137')
        .setFontColor('#FFFFFF')
        .setFontWeight('bold')
        .setFontSize(10)
      sheet.setFrozenRows(1)
      return sheet
    }
  }

  function getSeedTemplateSheet_() {
    try {
      return SpreadsheetService.getSheet(SEED_TEMPLATE_SHEET)
    } catch (e) {
      const ss = SpreadsheetService.getSpreadsheet()
      const sheet = ss.insertSheet(SEED_TEMPLATE_SHEET)
      sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS])
      sheet.getRange(1, 1, 1, HEADERS.length)
        .setBackground('#0D2137')
        .setFontColor('#FFFFFF')
        .setFontWeight('bold')
        .setFontSize(10)
      sheet.setFrozenRows(1)
      return sheet
    }
  }

  function getSeedTemplateRows_() {
    try {
      return SpreadsheetService.getAllRows(getSeedTemplateSheet_())
        .map(fromRow)
        .filter(row => String(row.status || '') !== 'Archived')
        .sort(questionSort_)
    } catch (e) {
      Logger.log('[AssessmentContent] Seed template unavailable, using built-in seed: ' + e.message)
      return []
    }
  }

  function questionSort_(a, b) {
    return String(a.domain).localeCompare(String(b.domain)) ||
      String(a.category).localeCompare(String(b.category)) ||
      (Number(a.sequence) || 0) - (Number(b.sequence) || 0) ||
      (Number(a.version) || 0) - (Number(b.version) || 0)
  }

  function appendRows_(sheet, rows) {
    if (!rows.length) return
    const values = rows.map(rowToValues_)
    sheet.getRange(sheet.getLastRow() + 1, 1, values.length, HEADERS.length).setValues(values)
    SpreadsheetService.invalidateSheet(sheet)
  }

  function replaceSheetRows_(sheet, rows) {
    clearDataRows_(sheet)
    appendRows_(sheet, rows)
  }

  function syncSeedTemplateAfterMutation_(row, profile) {
    const normalized = fromRow(row)
    const templateSheet = getSeedTemplateSheet_()
    const existing = SpreadsheetService.getAllRows(templateSheet)

    if (!existing.length && String(normalized.status || '') === 'Active') {
      const sourceRows = SpreadsheetService.getAllRows(getSheet())
        .map(fromRow)
        .filter(item => String(item.status || '') === 'Active')
        .sort(questionSort_)
      const now = new Date().toISOString()
      replaceSheetRows_(templateSheet, sourceRows.map(item => toRow({
        ...item,
        id: item.id,
        hasBeenUsed: false,
        createdBy: profile.id,
        createdByName: profile.fullName || profile.email,
        createdAt: now,
        updatedAt: now,
        archivedAt: '',
        changeNotes: item.changeNotes || 'Promoted from active assessment content'
      })))
      return
    }

    if (String(normalized.status || '') !== 'Active') {
      removeSeedTemplateRow_(normalized.id)
      return
    }

    const now = new Date().toISOString()
    const templateRow = toRow({
      ...normalized,
      id: normalized.id,
      hasBeenUsed: false,
      createdBy: profile.id,
      createdByName: profile.fullName || profile.email,
      createdAt: normalized.createdAt || now,
      updatedAt: now,
      archivedAt: '',
      changeNotes: normalized.changeNotes || 'Synced from active assessment content'
    })

    if (existing.some(item => String(item.id) === String(normalized.id))) {
      SpreadsheetService.updateRow(templateSheet, normalized.id, templateRow)
    } else {
      appendRows_(templateSheet, [templateRow])
    }
  }

  function removeSeedTemplateRow_(id) {
    if (!id) return
    try {
      SpreadsheetService.hardDeleteRow(getSeedTemplateSheet_(), id)
    } catch (e) {
      Logger.log('[AssessmentContent] Seed template row removal skipped for ' + id + ': ' + e.message)
    }
  }

  function clearDataRows_(sheet) {
    const lastRow = sheet.getLastRow()
    if (lastRow > 1) {
      sheet.deleteRows(2, lastRow - 1)
      SpreadsheetService.invalidateSheet(sheet)
    }
  }

  function rowToValues_(row) {
    return HEADERS.map(header => escapeFormula_(row[header]))
  }

  function escapeFormula_(value) {
    if (value === undefined || value === null) return ''
    if (typeof value !== 'string' || !value) return value
    if (value.charAt(0) === "'") return value
    if (!/^[=+\-@\t\r]/.test(value)) return value
    if (/^[+-]?(\d+\.?\d*|\.\d+)$/.test(value)) return value
    return "'" + value
  }

  function requireManager(user) {
    return AuthService.requirePermission(user, 'manage_assessment_content')
  }

  function validate(row) {
    if (!row.domain || !row.category || !row.questionText) {
      throw HttpError('Domain, category, and question text are required.', 400)
    }
    if (!parseJson(row.applicableRaters, []).length) {
      throw HttpError('Select at least one applicable rater type.', 400)
    }
    // Empty applicableLevels means all approved office roles. Participating
    // offices can use titles outside STB's built-in role labels.
  }

  function isUsedActive(row) {
    return String(row.status || '') === 'Active' && (row.hasBeenUsed === true || row.hasBeenUsed === 'TRUE')
  }

  function toRow(body) {
    const applicableRaters = String(body.domain || '').toLowerCase() === 'jf'
      ? JF_RATERS
      : normalizeRaters_(body.applicableRaters)
    return {
      id: body.id || '',
      domain: body.domain || '',
      category: body.category || '',
      questionText: body.questionText || '',
      guidanceText: body.guidanceText || '',
      sequence: Number(body.sequence) || 1,
      scaleType: body.scaleType || '1-4 Likert',
      required: body.required === true || body.required === 'true' || body.required === 'TRUE',
      evidenceRequired: body.evidenceRequired === true || body.evidenceRequired === 'true' || body.evidenceRequired === 'TRUE',
      applicableRaters: stringifyArray(applicableRaters),
      applicableLevels: stringifyArray(normalizeLevels_(body.applicableLevels)),
      status: body.status || 'Draft',
      period: body.period || '',
      version: Number(body.version) || 1,
      hasBeenUsed: body.hasBeenUsed === true || body.hasBeenUsed === 'true' || body.hasBeenUsed === 'TRUE',
      changeNotes: body.changeNotes || '',
      createdBy: body.createdBy || '',
      createdByName: body.createdByName || '',
      createdAt: body.createdAt || '',
      updatedAt: body.updatedAt || '',
      archivedAt: body.archivedAt || ''
    }
  }

  function fromRow(row) {
    const applicableRaters = String(row.domain || '').toLowerCase() === 'jf'
      ? JF_RATERS
      : normalizeRaters_(parseJson(row.applicableRaters, []))
    const applicableLevels = normalizeLevels_(parseJson(row.applicableLevels, []), false)
    return {
      ...row,
      domain: String(row.domain || '').trim().toLowerCase(),
      status: String(row.status || '').trim().toLowerCase() === 'active' ? 'Active' :
        (String(row.status || '').trim().toLowerCase() === 'archived' ? 'Archived' : 'Draft'),
      sequence: Number(row.sequence) || 1,
      version: Number(row.version) || 1,
      required: row.required === true || row.required === 'TRUE',
      evidenceRequired: row.evidenceRequired === true || row.evidenceRequired === 'TRUE',
      hasBeenUsed: row.hasBeenUsed === true || row.hasBeenUsed === 'TRUE',
      applicableRaters,
      applicableLevels
    }
  }

  function normalizeRaters_(value) {
    const aliases = {
      subordinate: 'Upward',
      upward: 'Upward',
      skipsupervisor: 'Skip Supervisor',
      'skip supervisor': 'Skip Supervisor',
      supervisor: 'Supervisor',
      peer: 'Peer',
      self: 'Self'
    }
    const raters = normalizeOptionArray_(value, aliases, CBC_RATERS)
    if (
      raters.indexOf('Self') >= 0 &&
      raters.indexOf('Peer') >= 0 &&
      raters.indexOf('Upward') >= 0 &&
      raters.indexOf('Supervisor') >= 0 &&
      raters.indexOf('Skip Supervisor') < 0
    ) {
      raters.push('Skip Supervisor')
    }
    return raters
  }

  // Employee levels are an OPEN vocabulary: each office defines its own roles in
  // OfficeOrgOptions (optionType 'role'), served per office as requestedRoles.
  // Across the cluster those include Admin Staff, Assistant Division Chief,
  // Deputy Program Manager, National Program Manager, Director, Undersecretary
  // and more - twelve distinct roles, only three of which SUPPORTED_LEVELS knew.
  //
  // This used to run through normalizeOptionArray_, which DISCARDS anything
  // outside its allowed list. So an office could not target its own roles: the
  // value vanished on save, and any ratee outside the three STB levels matched
  // no question at all and their raters opened an empty form.
  //
  // SUPPORTED_LEVELS survives only as the alias table that folds STB's legacy
  // spellings onto canonical labels. Any other role is preserved verbatim.
  function normalizeLevels_(value, defaultWhenEmpty) {
    const aliases = {
      'technical staff': 'Technical Staff',
      staff: 'Technical Staff',
      'section head': 'Section Head',
      'division chief': 'Division Chief'
      , 'oic dc': 'Division Chief'
      , 'oic- dc': 'Division Chief'
      , 'oic division chief': 'Division Chief'
      , 'officer in charge division chief': 'Division Chief'
    }
    const raw = parseJson(value, value || [])
    const items = Array.isArray(raw) ? raw : [raw]
    const seen = {}
    const levels = []
    items.forEach(item => {
      const trimmed = String(item || '').replace(/[​-‍﻿]/g, '').trim()
      if (!trimmed) return
      const label = aliases[trimmed.toLowerCase().replace(/[\s_-]+/g, ' ')] || trimmed
      const key = label.toLowerCase()
      if (seen[key]) return
      seen[key] = true
      levels.push(label)
    })
    return levels.length || !defaultWhenEmpty ? levels : SUPPORTED_LEVELS.slice()
  }

  function normalizeOptionArray_(value, aliases, allowed) {
    const raw = parseJson(value, value || [])
    const items = Array.isArray(raw) ? raw : [raw]
    const seen = {}
    const normalized = []
    items.forEach(item => {
      const key = String(item || '').trim().toLowerCase()
      const label = aliases[key]
      if (!label || seen[label]) return
      seen[label] = true
      normalized.push(label)
    })
    return normalized.filter(item => allowed.indexOf(item) >= 0)
  }

  function stringifyArray(value) {
    if (Array.isArray(value)) return JSON.stringify(value)
    if (!value) return JSON.stringify([])
    if (String(value).trim().charAt(0) === '[') return String(value)
    return JSON.stringify(String(value).split(',').map(v => v.trim()).filter(Boolean))
  }

  function parseJson(value, fallback) {
    if (Array.isArray(value)) return value
    try {
      if (!value) return fallback
      return JSON.parse(String(value))
    } catch (e) {
      return String(value || '').split(',').map(v => v.trim()).filter(Boolean)
    }
  }

  // An empty level list means "every role", and that is the default for a new
  // question. A non-empty list is an explicit choice an administrator made from
  // their own office's roles, so it is honoured as written.
  //
  // Matching is case- and spacing-insensitive because the two sides come from
  // different places: the list is typed/ticked in the content editor, while the
  // role arrives on the assignment row copied from the personnel record.
  //
  // A ratee with no role recorded cannot be evaluated against a restriction, so
  // they keep seeing the questions rather than an empty form - an unassessable
  // person is a worse outcome than an over-broad form.
  //
  // EvaluationView.levelAppliesToAssignment applies the identical rule. The two
  // MUST agree: the client renders from its copy while this one gates the
  // submission, so any divergence means a rater answers every question shown
  // and is still refused for an unanswered one they were never given.
  function levelKey_(value) {
    return String(value || '').replace(/[​-‍﻿]/g, '').trim().toLowerCase().replace(/[\s_-]+/g, ' ')
  }

  function levelApplies_(applicableLevels, level) {
    if (!applicableLevels.length) return true
    const key = levelKey_(level)
    if (!key) return true
    return applicableLevels.some(item => levelKey_(item) === key)
  }

  function requirementsForAssignment(assignment, user) {
    AuthService.getProfile(user)
    const raterAliases = {
      Self: 'Self', Peer: 'Peer', Peer1: 'Peer', Peer2: 'Peer',
      Subordinate: 'Upward', Supervisor: 'Supervisor', SkipSupervisor: 'Skip Supervisor'
    }
    const rater = raterAliases[String(assignment.raterType || '')] || String(assignment.raterType || '')
    const level = typeof RoleLabelService !== 'undefined'
      ? RoleLabelService.canonicalRole(assignment.rateeRole)
      : String(assignment.rateeRole || '').trim()
    const rows = SpreadsheetService.getAllRows(getSheet()).map(fromRow).filter(row =>
      row.status === 'Active' &&
      (!row.applicableRaters.length || row.applicableRaters.indexOf(rater) >= 0) &&
      levelApplies_(row.applicableLevels, level)
    )
    return {
      cbcCount: rows.filter(row => row.domain === 'cbc').length,
      jfCount: ['Self', 'Supervisor'].indexOf(String(assignment.raterType || '')) >= 0
        ? rows.filter(row => row.domain === 'jf').length : 0
    }
  }

  return { list, get, create, update, publish, archive, duplicateVersion, reorder, seed, promoteSeedTemplate, requirementsForAssignment }
})()
