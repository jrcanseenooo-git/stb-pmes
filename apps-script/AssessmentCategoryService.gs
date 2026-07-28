const AssessmentCategoryService = (() => {
  function sheetName_() { return (typeof SHEET !== 'undefined' && SHEET.ASSESSMENT_CATEGORIES) || 'AssessmentCategories' }
  const HEADERS = ['id', 'domainId', 'domainName', 'categoryId', 'categoryName', 'description', 'sequence', 'status', 'createdAt', 'updatedAt']

  function list(params, user) {
    AuthService.getProfile(user)
    let rows = SpreadsheetService.getAllRows(getSheet()).map(fromRow)
    if (params.domainId) rows = rows.filter(r => r.domainId === params.domainId)
    if (params.status)   rows = rows.filter(r => r.status === params.status)
    rows.sort((a, b) => String(a.domainId).localeCompare(String(b.domainId)) || (Number(a.sequence) || 0) - (Number(b.sequence) || 0))
    return SpreadsheetService.paginate(rows, params.page, params.pageSize || 200)
  }

  function get(id, user) {
    requireManager(user)
    var row = SpreadsheetService.getRow(getSheet(), id)
    if (!row) throw HttpError('Category not found', 404)
    return fromRow(row)
  }

  function create(body, user) {
    requireManager(user)
    var now = new Date().toISOString()
    var entry = toRow({
      ...body,
      id: SpreadsheetService.generateId('ACAT-'),
      status: body.status || 'Active',
      createdAt: now,
      updatedAt: now
    })
    validate(entry)
    SpreadsheetService.appendRow(getSheet(), entry)
    AuditService.log('CREATE', 'AssessmentCategory', 'Created category ' + entry.categoryName, user)
    return fromRow(entry)
  }

  function update(id, body, user) {
    requireManager(user)
    var sheet = getSheet()
    var current = SpreadsheetService.getRow(sheet, id)
    if (!current) throw HttpError('Category not found', 404)
    var updates = toRow({
      ...current,
      ...body,
      id: id,
      createdAt: current.createdAt,
      updatedAt: new Date().toISOString()
    })
    validate(updates)
    var updated = SpreadsheetService.updateRow(sheet, id, updates)
    AuditService.log('UPDATE', 'AssessmentCategory', 'Updated category ' + updates.categoryName, user)
    return fromRow(updated)
  }

  function remove(id, user) {
    requireManager(user)
    var sheet = getSheet()
    var row = SpreadsheetService.getRow(sheet, id)
    if (!row) throw HttpError('Category not found', 404)
    SpreadsheetService.hardDeleteRow(sheet, id)
    AuditService.log('DELETE', 'AssessmentCategory', 'Deleted category ' + row.categoryName, user)
    return { deleted: id }
  }

  function seed(body, user) {
    requireManager(user)
    var sheet = getSheet()
    var existing = SpreadsheetService.getAllRows(sheet)
    if (existing.length > 0 && !body.force) {
      throw HttpError('Categories already seeded (' + existing.length + '). Pass force:true to reseed.', 409)
    }
    if (existing.length > 0 && body.force) {
      existing.forEach(function(row) { try { SpreadsheetService.hardDeleteRow(sheet, row.id) } catch(e) {} })
    }

    var now = new Date().toISOString()
    var created = []
    var defaults = getDefaults_()
    defaults.forEach(function(item) {
      var entry = toRow({
        id: SpreadsheetService.generateId('ACAT-'),
        domainId: item.domainId,
        domainName: item.domainName,
        categoryId: item.categoryId,
        categoryName: item.categoryName,
        description: item.description,
        sequence: item.sequence,
        status: 'Active',
        createdAt: now,
        updatedAt: now
      })
      SpreadsheetService.appendRow(sheet, entry)
      created.push(entry.id)
    })
    AuditService.log('SEED', 'AssessmentCategory', 'Seeded ' + created.length + ' assessment categories', user)
    return { seeded: created.length }
  }

  function getDefaults_() {
    return [
      { domainId: 'cbc', domainName: 'Core Behavioral Competencies', categoryId: 'makatao', categoryName: 'Makatao', description: 'Reflects the commitment of personnel to uphold the dignity, worth, and rights of every individual by fostering a workplace culture grounded in respect, empathy, inclusivity, and fairness.', sequence: 1 },
      { domainId: 'cbc', domainName: 'Core Behavioral Competencies', categoryId: 'mapagpalaya', categoryName: 'Mapagpalaya', description: 'Represents the transformative and liberating power of social work and social development, specifically through the design and implementation of innovative programs.', sequence: 2 },
      { domainId: 'cbc', domainName: 'Core Behavioral Competencies', categoryId: 'marangal', categoryName: 'Marangal', description: 'Represents the commitment to ethical excellence, accountability, and continuous professional development in social work and public service.', sequence: 3 },
      { domainId: 'cbc', domainName: 'Core Behavioral Competencies', categoryId: 'marunong', categoryName: 'Marunong', description: 'Refers to an employee\'s ability to demonstrate sound technical knowledge, critical thinking, continuous learning, and innovation in the performance of their duties.', sequence: 4 },
      { domainId: 'cbc', domainName: 'Core Behavioral Competencies', categoryId: 'mapagpabago', categoryName: 'Mapagpabago', description: 'Represents the commitment to transformational leadership and the pursuit of systemic change through innovation, continuous improvement, and sustainable social development.', sequence: 5 },
      { domainId: 'jf', domainName: 'Job Fitness', categoryId: 'educational-fit', categoryName: 'Educational Qualification Fit', description: 'The employee demonstrates and applies academic knowledge, specialized training, or theoretical foundations effectively to execute daily job functions.', sequence: 1 },
      { domainId: 'jf', domainName: 'Job Fitness', categoryId: 'experience-alignment', categoryName: 'Relevant Work Experience Alignment', description: 'Prior experience that directly supports the competencies and technical requirements of the current role.', sequence: 2 },
      { domainId: 'jf', domainName: 'Job Fitness', categoryId: 'training-skills', categoryName: 'Training and Skills Applicability', description: 'Actively integrates skills gained from training or professional development directly into work workflows to improve efficiency.', sequence: 3 },
      { domainId: 'jf', domainName: 'Job Fitness', categoryId: 'organizational-objectives', categoryName: 'Commitment to Organizational Objectives', description: 'Demonstrates alignment with program goals through consistent work engagement and support for organizational priorities.', sequence: 4 },
      { domainId: 'jf', domainName: 'Job Fitness', categoryId: 'attendance-punctuality', categoryName: 'Attendance and Punctuality Compliance', description: 'Maintains regular attendance and adheres to prescribed work schedules. Scored based on DTR records using the threshold table.', sequence: 5 }
    ]
  }

  function getSheet() {
    try {
      return SpreadsheetService.getSheet(sheetName_())
    } catch (e) {
      var ss = SpreadsheetService.getSpreadsheet()
      var sheet = ss.insertSheet(sheetName_())
      sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS])
      sheet.getRange(1, 1, 1, HEADERS.length).setBackground('#0D2137').setFontColor('#FFFFFF').setFontWeight('bold').setFontSize(10)
      sheet.setFrozenRows(1)
      return sheet
    }
  }

  function requireManager(user) { return AuthService.requirePermission(user, 'manage_assessment_content') }

  function validate(row) {
    if (!row.domainId || !row.categoryId || !row.categoryName) throw HttpError('Domain ID, category ID, and category name are required.', 400)
  }

  function toRow(body) {
    return {
      id: body.id || '',
      domainId: body.domainId || '',
      domainName: body.domainName || '',
      categoryId: body.categoryId || '',
      categoryName: body.categoryName || '',
      description: body.description || '',
      sequence: Number(body.sequence) || 1,
      status: body.status || 'Active',
      createdAt: body.createdAt || '',
      updatedAt: body.updatedAt || ''
    }
  }

  function fromRow(row) {
    return { ...row, sequence: Number(row.sequence) || 1 }
  }

  return { list, get, create, update, remove, seed }
})()
