const AssessmentContentService = (() => {
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

    if (params.domain) rows = rows.filter(r => r.domain === params.domain)
    if (params.category) rows = rows.filter(r => r.category === params.category)
    if (params.status) rows = rows.filter(r => r.status === params.status)
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
    AuditService.log('CREATE', 'AssessmentContent', 'Created assessment question ' + entry.id, user)
    return fromRow(entry)
  }

  function update(id, body, user) {
    requireManager(user)
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
    AuditService.log('UPDATE', 'AssessmentContent', 'Updated assessment question ' + id, user)
    return fromRow(updated)
  }

  function publish(id, body, user) {
    requireManager(user)
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
    AuditService.log('PUBLISH', 'AssessmentContent', 'Published assessment question ' + id, user)
    return fromRow(updated)
  }

  function archive(id, user) {
    requireManager(user)
    const updates = { status: 'Archived', archivedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    const updated = SpreadsheetService.updateRow(getSheet(), id, updates)
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

  // ── Seed from hardcoded HEARTWORK + JF indicators ──
  function seed(body, user) {
    requireManager(user)
    const sheet = getSheet()
    const existing = SpreadsheetService.getAllRows(sheet)
    if (existing.length > 0 && !body.force) {
      throw HttpError('Assessment content already seeded (' + existing.length + ' questions). Pass force:true to reseed.', 409)
    }

    if (existing.length > 0 && body.force) {
      existing.forEach(row => {
        try { SpreadsheetService.hardDeleteRow(sheet, row.id) } catch (e) {}
      })
    }

    const themes = IPATService.getThemes()
    const jfIndicators = IPATService.getJFIndicators()
    const now = new Date().toISOString()
    const created = []

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
          applicableRaters: JSON.stringify(['Self', 'Peer', 'Subordinate', 'Supervisor']),
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
        SpreadsheetService.appendRow(sheet, entry)
        created.push(entry.id)
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
        applicableRaters: JSON.stringify(['Self', 'Peer', 'Supervisor', 'Skip Supervisor']),
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
      SpreadsheetService.appendRow(sheet, entry)
      created.push(entry.id)
    })

    AuditService.log('SEED', 'AssessmentContent', 'Seeded ' + created.length + ' assessment questions from HEARTWORK + JF indicators', user)
    return { seeded: created.length, cbcCount: themes.reduce((s, t) => s + t.indicators.length, 0), jfCount: jfIndicators.length }
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

  function requireManager(user) {
    return AuthService.requirePermission(user, 'manage_assessment_content')
  }

  function validate(row) {
    if (!row.domain || !row.category || !row.questionText) {
      throw HttpError('Domain, category, and question text are required.', 400)
    }
  }

  function isUsedActive(row) {
    return String(row.status || '') === 'Active' && (row.hasBeenUsed === true || row.hasBeenUsed === 'TRUE')
  }

  function toRow(body) {
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
      applicableRaters: stringifyArray(body.applicableRaters),
      applicableLevels: stringifyArray(body.applicableLevels),
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
    return {
      ...row,
      sequence: Number(row.sequence) || 1,
      version: Number(row.version) || 1,
      required: row.required === true || row.required === 'TRUE',
      evidenceRequired: row.evidenceRequired === true || row.evidenceRequired === 'TRUE',
      hasBeenUsed: row.hasBeenUsed === true || row.hasBeenUsed === 'TRUE',
      applicableRaters: parseJson(row.applicableRaters, []),
      applicableLevels: parseJson(row.applicableLevels, [])
    }
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

  return { list, get, create, update, publish, archive, duplicateVersion, reorder, seed }
})()
