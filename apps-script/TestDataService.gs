/**
 * TestDataService.gs
 *
 * Central-admin-only utilities for reversible dashboard test data.
 *
 * Safety model:
 *  - Every seeded row id starts with TESTPMES-.
 *  - Cleanup deletes only rows with that prefix.
 *  - Dashboard dummy data does not create Firebase users.
 *  - Test login accounts are created only through UsersService, then can be
 *    removed through the paired cleanup route/function.
 *  - Real user, rating, and office configuration rows are never modified.
 */
const TestDataService = (() => {
  const PREFIX = 'TESTPMES-'
  const ACCOUNT_EMAIL_PREFIX = 'pmes.test.'
  const ACCOUNT_EMAIL_DOMAIN = 'dswd.gov.ph'
  const ACCOUNT_NAME_PREFIX = '[TEST ACCOUNT]'
  const ACCOUNT_PASSWORD = 'PMES-Test@2026!'
  const DEFAULT_SEMESTER = 2
  const DEFAULT_YEAR = 2026

  function seed(body, user) {
    const profile = requireCentralAdmin_(user)
    const period = resolvePeriod_(body || {})
    const offices = targetOffices_(body || {})
    const results = []

    offices.forEach(office => {
      const run = () => seedCurrentSpreadsheet_(office, period, profile)
      const result = office.spreadsheetId === 'CENTRAL_PMES'
        ? SpreadsheetService.withCentralSpreadsheet(run)
        : SpreadsheetService.withSpreadsheetId(office.spreadsheetId, run)
      results.push({ officeCode: office.officeCode, officeName: office.officeName, ...result })
    })

    audit_('SEED_TEST_DATA', 'Seeded reversible test data for ' + results.length + ' office(s).', user)
    return { seeded: true, period, offices: results }
  }

  /**
   * Reports exactly what cleanup() and cleanupAccounts() WOULD remove, and
   * removes nothing.
   *
   * The destructive pair had no dry run, so the only way to find out what they
   * would take was to let them take it. This mirrors their traversal and
   * predicates precisely - same sheets, same TESTPMES- id test, same
   * test-account rule - so the counts it reports are the rows that would go.
   */
  function preview(body, user) {
    requireCentralAdmin_(user)
    const offices = targetOffices_(body || {})
    const perOffice = []
    let seededRows = 0
    let rosterAccounts = 0

    offices.forEach(office => {
      const run = () => previewCurrentSpreadsheet_()
      const result = office.spreadsheetId === 'CENTRAL_PMES'
        ? SpreadsheetService.withCentralSpreadsheet(run)
        : SpreadsheetService.withSpreadsheetId(office.spreadsheetId, run)
      seededRows += result.seededRows
      rosterAccounts += result.testAccounts
      perOffice.push({ officeCode: office.officeCode, officeName: office.officeName, ...result })
    })

    // The central Users sheet holds the login accounts cleanupAccounts deletes.
    // Listed in full rather than counted, so a human can confirm every one is
    // genuinely a test account before anything is removed.
    const centralAccounts = SpreadsheetService.withCentralSpreadsheet(() => {
      const sheet = SpreadsheetService.getSheet(SHEET.USERS)
      return SpreadsheetService.getAllRows(sheet)
        .filter(isTestAccountRow_)
        .map(row => ({ id: row.id, email: row.email, fullName: row.fullName }))
    })

    return {
      preview: true,
      nothingWasDeleted: true,
      totals: {
        seededRows: seededRows,
        officeRosterTestAccounts: rosterAccounts,
        centralLoginAccounts: centralAccounts.length
      },
      centralLoginAccounts: centralAccounts,
      offices: perOffice
    }
  }

  function previewCurrentSpreadsheet_() {
    // Identical sheet list to cleanupCurrentSpreadsheet_ - if one changes, the
    // other must, or the preview stops telling the truth.
    const sheets = [
      ['Personnel', 'Users'],
      ['AssessmentRecords', SHEET.IPAT_RECORDS],
      ['RaterAssignments', SHEET.IPAT_ASSIGNMENTS],
      ['CompetencyBehaviorRatings', SHEET.IPAT_CBC_RATINGS],
      ['JobFitnessRatings', SHEET.IPAT_JF_RATINGS],
      ['RatingDrafts', 'RatingDrafts']
    ]
    let seededRows = 0
    const details = []
    sheets.forEach(names => {
      const sheet = firstSheet_(names)
      if (!sheet) return
      const rows = SpreadsheetService.getAllRows(sheet)
      const seeded = rows.filter(row => String(row.id || '').trim().indexOf(PREFIX) === 0).length
      if (seeded) {
        details.push({ sheet: sheet.getName(), seededRows: seeded, totalRows: rows.length })
        seededRows += seeded
      }
    })

    const personnel = firstSheet_(['Personnel', 'Users'])
    const testAccounts = personnel
      ? SpreadsheetService.getAllRows(personnel).filter(isTestAccountRow_).length
      : 0

    return { seededRows, testAccounts, details }
  }

  function cleanup(body, user) {
    requireCentralAdmin_(user)
    const input = body || {}
    if (String(input.confirm || '') !== 'DELETE_TEST_DATA') {
      throw HttpError('Cleanup requires confirm: DELETE_TEST_DATA', 400)
    }

    const offices = targetOffices_(input)
    const results = []
    offices.forEach(office => {
      const run = () => cleanupCurrentSpreadsheet_()
      const result = office.spreadsheetId === 'CENTRAL_PMES'
        ? SpreadsheetService.withCentralSpreadsheet(run)
        : SpreadsheetService.withSpreadsheetId(office.spreadsheetId, run)
      results.push({ officeCode: office.officeCode, officeName: office.officeName, ...result })
    })

    audit_('CLEANUP_TEST_DATA', 'Removed reversible test data for ' + results.length + ' office(s).', user)
    return { cleaned: true, offices: results }
  }

  function seedAccounts(body, user) {
    const profile = requireCentralAdmin_(user)
    const input = body || {}
    const offices = targetOffices_(input)
    const cleanupResult = cleanupAccounts({ officeIds: input.officeIds || input.offices || 'all', confirm: 'DELETE_TEST_ACCOUNTS' }, user)
    const created = []
    const errors = []

    offices.forEach(office => {
      const org = orgOptionsFor_(office.officeId)
      const accounts = accountRowsFor_(office, org)
      accounts.forEach(account => {
        try {
          const result = UsersService.create(account, user)
          created.push({
            officeCode: office.officeCode,
            officeName: office.officeName,
            email: account.email,
            fullName: account.fullName,
            role: account.role,
            officeRole: account.officeRole,
            systemScope: account.systemScope,
            firebaseCreated: !!result.firebaseCreated,
            rosterSync: result.officePersonnelSync || null
          })
        } catch (e) {
          errors.push({
            officeCode: office.officeCode,
            email: account.email,
            message: String(e && e.message || e)
          })
        }
      })
    })

    audit_('SEED_TEST_ACCOUNTS', 'Created ' + created.length + ' reversible test login account(s).', user)
    return {
      seeded: errors.length === 0,
      createdCount: created.length,
      errorCount: errors.length,
      password: ACCOUNT_PASSWORD,
      cleanupBeforeSeed: cleanupResult,
      accounts: created,
      errors
    }
  }

  function cleanupAccounts(body, user) {
    requireCentralAdmin_(user)
    const input = body || {}
    if (String(input.confirm || '') !== 'DELETE_TEST_ACCOUNTS') {
      throw HttpError('Cleanup requires confirm: DELETE_TEST_ACCOUNTS', 400)
    }

    const centralDeleted = SpreadsheetService.withCentralSpreadsheet(() => {
      const sheet = SpreadsheetService.getSheet(SHEET.USERS)
      const rows = SpreadsheetService.getAllRows(sheet).filter(isTestAccountRow_)
      const deleted = []
      const errors = []
      rows.forEach(row => {
        try {
          UsersService.remove(row.id, user)
          deleted.push({ id: row.id, email: row.email, fullName: row.fullName })
        } catch (e) {
          errors.push({ id: row.id, email: row.email, message: String(e && e.message || e) })
        }
      })
      return { deletedCount: deleted.length, errorCount: errors.length, deleted, errors }
    })

    const offices = targetOffices_(input)
    const officeRosterCleanup = []
    offices.forEach(office => {
      if (office.spreadsheetId === 'CENTRAL_PMES') return
      const result = SpreadsheetService.withSpreadsheetId(office.spreadsheetId, () => cleanupTestPersonnelRows_())
      officeRosterCleanup.push({ officeCode: office.officeCode, officeName: office.officeName, ...result })
    })

    audit_('CLEANUP_TEST_ACCOUNTS', 'Removed reversible test login account(s).', user)
    return { cleaned: true, centralUsers: centralDeleted, officeRosters: officeRosterCleanup }
  }

  function seedCurrentSpreadsheet_(office, period, profile) {
    const removed = cleanupCurrentSpreadsheet_()
    const now = new Date().toISOString()
    const org = orgOptionsFor_(office.officeId)
    const divisionA = org.divisions[0] || { id: 'TEST-DIV-A', name: 'Test Division A' }
    const divisionB = org.divisions[1] || org.divisions[0] || { id: 'TEST-DIV-B', name: 'Test Division B' }
    const sectionA = firstSectionFor_(org.sections, divisionA) || { id: 'TEST-SEC-A', name: 'Test Section A' }
    const sectionB = firstSectionFor_(org.sections, divisionB) || { id: 'TEST-SEC-B', name: 'Test Section B' }
    const officeKey = safeKey_(office.officeCode || office.officeId || 'OFFICE')
    const base = PREFIX + officeKey + '-' + period.year + 'S' + period.semester + '-'

    const people = [
      person_(base, 1, office, divisionA, sectionA, 'Division Chief', now),
      person_(base, 2, office, divisionA, sectionA, 'Section Head', now),
      person_(base, 3, office, divisionA, sectionA, 'Technical Staff', now),
      person_(base, 4, office, divisionA, sectionA, 'Technical Staff', now),
      person_(base, 5, office, divisionB, sectionB, 'Section Head', now),
      person_(base, 6, office, divisionB, sectionB, 'Technical Staff', now)
    ]

    appendRows_('Personnel', 'Users', people)

    const records = [
      record_(base, 1, office, people[0], 3.92, 'Outstanding', period, now),
      record_(base, 2, office, people[1], 3.74, 'Outstanding', period, now),
      record_(base, 3, office, people[2], 3.18, 'Very Satisfactory', period, now),
      record_(base, 4, office, people[3], 2.21, 'Needs Improvement', period, now),
      record_(base, 5, office, people[4], 2.43, 'Needs Improvement', period, now),
      record_(base, 6, office, people[5], 3.37, 'Very Satisfactory', period, now)
    ]
    appendRows_('AssessmentRecords', SHEET.IPAT_RECORDS, records)

    const assignments = []
    records.forEach((record, index) => {
      const ratee = people[index]
      assignments.push(assignment_(base, record, ratee, people[0], 'Self', 'Completed', period, now, 1))
      assignments.push(assignment_(base, record, ratee, people[1], 'Peer', index % 2 === 0 ? 'Pending' : 'Completed', period, now, 2))
      assignments.push(assignment_(base, record, ratee, people[4], 'Immediate Supervisor', index >= 3 ? 'Pending' : 'Completed', period, now, 3))
    })
    appendRows_('RaterAssignments', SHEET.IPAT_ASSIGNMENTS, assignments)

    return {
      removedBeforeSeed: removed.deletedRows,
      personnel: people.length,
      assessmentRecords: records.length,
      raterAssignments: assignments.length
    }
  }

  function cleanupCurrentSpreadsheet_() {
    const sheets = [
      ['Personnel', 'Users'],
      ['AssessmentRecords', SHEET.IPAT_RECORDS],
      ['RaterAssignments', SHEET.IPAT_ASSIGNMENTS],
      ['CompetencyBehaviorRatings', SHEET.IPAT_CBC_RATINGS],
      ['JobFitnessRatings', SHEET.IPAT_JF_RATINGS],
      ['RatingDrafts', 'RatingDrafts']
    ]
    let deletedRows = 0
    const details = []
    sheets.forEach(names => {
      const sheet = firstSheet_(names)
      if (!sheet) return
      const ids = SpreadsheetService.getAllRows(sheet)
        .map(row => String(row.id || '').trim())
        .filter(id => id.indexOf(PREFIX) === 0)
      ids.forEach(id => {
        SpreadsheetService.hardDeleteRow(sheet, id)
        deletedRows += 1
      })
      if (ids.length) details.push({ sheet: sheet.getName(), deletedRows: ids.length })
    })
    return { deletedRows, details }
  }

  function accountRowsFor_(office, org) {
    const officeKey = safeKey_(office.officeCode || office.officeId || 'OFFICE')
    const officeLabel = office.officeShortName || office.officeCode || officeKey
    const unit = org.divisions[0] || { id: '', name: 'Test Division A' }
    const section = firstSectionFor_(org.sections, unit) || { id: '', name: '' }
    const roles = org.roles || []
    const highRole = chooseHighRole_(roles)
    const staffRole = roles.some(role => String(role.name || '').trim() === 'Technical Staff')
      ? 'Technical Staff'
      : 'Technical Staff'
    const baseAccount = {
      type: 'Contract of Service (COS)',
      divisionId: unit.id || unit.code || unit.name || '',
      divisionName: unit.name || '',
      section: section.name || '',
      officeId: office.officeId || office.officeCode || '',
      officeCode: office.officeCode || office.officeId || '',
      officeName: office.officeName || '',
      tempPassword: ACCOUNT_PASSWORD,
      active: true,
      pendingActivation: false,
      mustChangePassword: true
    }

    if (String(office.officeId || office.officeCode || '').trim().toUpperCase() === 'STB') {
      return [
        {
          ...baseAccount,
          email: testAccountEmail_(officeKey, 'admin'),
          fullName: ACCOUNT_NAME_PREFIX + ' ' + officeLabel + ' System Admin',
          employeeNo: 'TEST-' + officeKey + '-ADMIN',
          role: 'System Administrator',
          position: 'System Administrator',
          positionLevel: 'System Administrator',
          systemScope: 'CLUSTER_ADMIN',
          officeRole: 'STB_PERSONNEL',
          permissionGroups: 'system-admin,cluster-system-admin',
          permissions: '',
          centralRoles: 'cluster-admin'
        },
        {
          ...baseAccount,
          email: testAccountEmail_(officeKey, 'staff'),
          fullName: ACCOUNT_NAME_PREFIX + ' ' + officeLabel + ' Technical Staff',
          employeeNo: 'TEST-' + officeKey + '-STAFF',
          role: 'Technical Staff',
          position: 'Technical Staff',
          positionLevel: 'Technical Staff',
          systemScope: 'STB_FULL',
          officeRole: 'STB_PERSONNEL',
          permissionGroups: '',
          permissions: '',
          centralRoles: ''
        }
      ]
    }

    return [
      {
        ...baseAccount,
        email: testAccountEmail_(officeKey, 'admin'),
        fullName: ACCOUNT_NAME_PREFIX + ' ' + officeLabel + ' Office Admin',
        employeeNo: 'TEST-' + officeKey + '-ADMIN',
        role: 'System Administrator',
        position: 'System Administrator',
        positionLevel: 'System Administrator',
        systemScope: 'CLUSTER_PORTAL',
        officeRole: 'OFFICE_ADMIN',
        permissionGroups: '',
        permissions: '',
        centralRoles: ''
      },
      {
        ...baseAccount,
        email: testAccountEmail_(officeKey, 'reviewer'),
        fullName: ACCOUNT_NAME_PREFIX + ' ' + officeLabel + ' ' + highRole,
        employeeNo: 'TEST-' + officeKey + '-REVIEWER',
        role: highRole,
        position: highRole,
        positionLevel: highRole,
        systemScope: 'CLUSTER_PORTAL',
        officeRole: 'OFFICE_PERSONNEL',
        permissionGroups: '',
        permissions: '',
        centralRoles: ''
      },
      {
        ...baseAccount,
        email: testAccountEmail_(officeKey, 'staff'),
        fullName: ACCOUNT_NAME_PREFIX + ' ' + officeLabel + ' Technical Staff',
        employeeNo: 'TEST-' + officeKey + '-STAFF',
        role: staffRole,
        position: staffRole,
        positionLevel: staffRole,
        systemScope: 'CLUSTER_PORTAL',
        officeRole: 'OFFICE_PERSONNEL',
        permissionGroups: '',
        permissions: '',
        centralRoles: ''
      }
    ]
  }

  function chooseHighRole_(roles) {
    const names = roles.map(row => String(row.name || '').trim()).filter(Boolean)
    const preferred = [
      'Undersecretary',
      'Bureau Director',
      'Director',
      'Assistant Bureau Director',
      'Deputy Program Manager',
      'Division Chief',
      'Section Head',
      'Senior Technical Staff'
    ]
    for (let i = 0; i < preferred.length; i++) {
      if (names.indexOf(preferred[i]) >= 0) return preferred[i]
    }
    return names[0] || 'Division Chief'
  }

  function cleanupTestPersonnelRows_() {
    const sheet = firstSheet_(['Personnel', 'Users'])
    if (!sheet) return { deletedRows: 0, details: [] }
    const rows = SpreadsheetService.getAllRows(sheet).filter(isTestAccountRow_)
    rows.forEach(row => SpreadsheetService.hardDeleteRow(sheet, row.id))
    return {
      deletedRows: rows.length,
      details: rows.map(row => ({ id: row.id, email: row.email, fullName: row.fullName }))
    }
  }

  function person_(base, index, office, division, section, role, now) {
    const id = base + 'USR-' + pad_(index)
    return {
      id,
      uid: '',
      email: 'testdata+' + safeKey_(office.officeCode || office.officeId).toLowerCase() + pad_(index) + '@example.invalid',
      fullName: '[TEST] ' + (office.officeShortName || office.officeCode || 'Office') + ' Personnel ' + index,
      employeeNo: 'TEST-' + pad_(index),
      position: role,
      positionLevel: role,
      role,
      divisionId: division.id || division.code || division.name || '',
      divisionName: division.name || '',
      organizationalUnitId: division.id || division.code || division.name || '',
      organizationalUnitName: division.name || '',
      section: section.name || '',
      officeId: office.officeId || office.officeCode || '',
      officeCode: office.officeCode || office.officeId || '',
      officeName: office.officeName || '',
      systemScope: office.officeId === 'STB' ? 'STB_FULL' : 'CLUSTER_PORTAL',
      officeRole: 'OFFICE_PERSONNEL',
      active: true,
      pendingActivation: false,
      createdAt: now,
      updatedAt: now,
      validatedAt: now,
      validatedBy: 'TEST_DATA'
    }
  }

  function record_(base, index, office, person, score, descriptor, period, now) {
    return {
      id: base + 'REC-' + pad_(index),
      officeId: office.officeId || office.officeCode || '',
      rateeId: person.id,
      rateeName: person.fullName,
      divisionId: person.divisionId,
      divisionName: person.divisionName,
      organizationalUnitId: person.organizationalUnitId,
      position: person.position,
      positionLevel: person.positionLevel,
      semester: period.semester,
      year: period.year,
      hasSubordinate: person.role === 'Division Chief' || person.role === 'Section Head',
      status: 'Computed',
      cbcBaseScore: score,
      cbcScore: score,
      fpoScore: score,
      jfScore: score,
      overallScore: score,
      descriptor,
      createdAt: now,
      updatedAt: now
    }
  }

  function assignment_(base, record, ratee, rater, raterType, status, period, now, index) {
    return {
      id: base + 'ASN-' + record.id.split('-').pop() + '-' + pad_(index),
      officeId: record.officeId,
      semester: period.semester,
      year: period.year,
      rateeId: ratee.id,
      rateeName: ratee.fullName,
      rateeDivisionId: ratee.divisionId,
      rateeUnitId: ratee.organizationalUnitId,
      rateeRole: ratee.role,
      rateeSection: ratee.section,
      raterId: rater.id,
      raterName: rater.fullName,
      raterType,
      ipatRecordId: record.id,
      assessmentRecordId: record.id,
      status,
      completedAt: status === 'Completed' ? now : '',
      createdAt: now,
      updatedAt: now
    }
  }

  function targetOffices_(body) {
    const requested = body.officeIds || body.offices || 'all'
    const rows = getOfficeRows_()
    if (requested === 'all' || (Array.isArray(requested) && requested.indexOf('all') >= 0)) return rows
    const wanted = (Array.isArray(requested) ? requested : String(requested).split(','))
      .map(item => normalizeKey_(item))
      .filter(Boolean)
    return rows.filter(row => {
      const keys = [row.officeId, row.officeCode, row.officeShortName, row.officeName].map(normalizeKey_)
      return keys.some(key => wanted.indexOf(key) >= 0)
    })
  }

  function getOfficeRows_() {
    const builtInStb = {
      officeId: 'STB',
      officeCode: 'STB',
      officeShortName: 'STB',
      officeName: 'Social Technology Bureau',
      spreadsheetId: 'CENTRAL_PMES'
    }
    const offices = SpreadsheetService.withCentralSpreadsheet(() => {
      try {
        return SpreadsheetService.getAllRows(SpreadsheetService.getSheet(SHEET.OFFICE_REGISTRY))
          .filter(row => row.spreadsheetId && String(row.spreadsheetStatus || '').toUpperCase() === 'ACTIVE')
          .map(row => ({
            officeId: row.officeId,
            officeCode: row.officeCode,
            officeShortName: row.officeShortName || row.officeCode,
            officeName: row.officeName,
            spreadsheetId: row.spreadsheetId
          }))
      } catch (e) {
        return []
      }
    })
    return [builtInStb].concat(offices)
  }

  function orgOptionsFor_(officeId) {
    return SpreadsheetService.withCentralSpreadsheet(() => {
      let rows = []
      try {
        rows = SpreadsheetService.getAllRows(SpreadsheetService.getSheet(SHEET.OFFICE_ORG_OPTIONS))
          .filter(row =>
            String(row.officeId || '').trim().toUpperCase() === String(officeId || '').trim().toUpperCase() &&
            (row.active === true || String(row.active).toLowerCase() === 'true')
          )
      } catch (e) {
        rows = []
      }
      const divisions = rows
        .filter(row => String(row.optionType || '').toLowerCase() === 'division')
        .sort((a, b) => Number(a.sequence || 0) - Number(b.sequence || 0))
      const sections = rows
        .filter(row => String(row.optionType || '').toLowerCase() === 'section')
        .sort((a, b) => Number(a.sequence || 0) - Number(b.sequence || 0))
      const roles = rows
        .filter(row => String(row.optionType || '').toLowerCase() === 'role')
        .sort((a, b) => Number(a.sequence || 0) - Number(b.sequence || 0))
      return { divisions, sections, roles }
    })
  }

  function firstSectionFor_(sections, division) {
    const parentId = String(division && division.id || '').trim()
    return sections.find(section => String(section.parentId || '').trim() === parentId) || sections[0] || null
  }

  function appendRows_(primaryName, fallbackName, rows) {
    const sheet = firstSheet_([primaryName, fallbackName])
    if (!sheet) throw new Error('Required sheet not found: ' + primaryName)
    rows.forEach(row => SpreadsheetService.appendRow(sheet, row))
  }

  function firstSheet_(names) {
    for (let i = 0; i < names.length; i++) {
      if (!names[i]) continue
      try {
        return SpreadsheetService.getSheet(names[i])
      } catch (e) {
        // Try next candidate.
      }
    }
    return null
  }

  function requireCentralAdmin_(user) {
    const profile = AuthService.getProfile(user)
    if (
      !AuthService.hasPermission(profile, 'manage_office_registry') &&
      !AuthService.hasPermission(profile, 'view_cluster_monitoring') &&
      !AuthService.hasPermission(profile, 'manage_database')
    ) {
      throw HttpError('Access denied. Central administrator role required.', 403)
    }
    return profile
  }

  function resolvePeriod_(body) {
    return {
      semester: Number(body.semester || body.sem || DEFAULT_SEMESTER),
      year: Number(body.year || DEFAULT_YEAR)
    }
  }

  function audit_(action, summary, user) {
    try {
      AuditService.log(action, 'TestData', summary, user)
    } catch (e) {
      Logger.log('[TestData] audit failed: ' + (e && e.message || e))
    }
  }

  function safeKey_(value) {
    return String(value || 'OFFICE').toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '') || 'OFFICE'
  }

  function testAccountEmail_(officeKey, suffix) {
    return ACCOUNT_EMAIL_PREFIX + String(officeKey || 'office').toLowerCase() + '.' + suffix + '@' + ACCOUNT_EMAIL_DOMAIN
  }

  function isTestAccountRow_(row) {
    const email = String(row && row.email || '').trim().toLowerCase()
    const name = String(row && row.fullName || '').trim()
    return email.indexOf(ACCOUNT_EMAIL_PREFIX) === 0 &&
      email.endsWith('@' + ACCOUNT_EMAIL_DOMAIN) &&
      name.indexOf(ACCOUNT_NAME_PREFIX) === 0
  }

  function normalizeKey_(value) {
    return safeKey_(value)
  }

  function pad_(value) {
    return ('0' + value).slice(-2)
  }

  return { preview, seed, cleanup, seedAccounts, cleanupAccounts }
})()

/**
 * Run this FIRST, from the Apps Script editor, before either cleanup below.
 * It deletes nothing - it reports what the cleanups would remove, per office
 * and per sheet, and lists every login account that would go by name.
 */
function previewTestDataForAllOffices() {
  const result = TestDataService.preview(
    { officeIds: 'all' },
    { email: 'systemadmin@dswd.gov.ph', uid: 'TEST_DATA_RUNNER' }
  )
  Logger.log(JSON.stringify(result, null, 2))
  return result
}

function seedDashboardDummyDataForAllOffices() {
  return TestDataService.seed(
    { officeIds: 'all', semester: 2, year: 2026 },
    { email: 'systemadmin@dswd.gov.ph', uid: 'TEST_DATA_RUNNER' }
  )
}

function cleanupDashboardDummyDataForAllOffices() {
  return TestDataService.cleanup(
    { officeIds: 'all', confirm: 'DELETE_TEST_DATA' },
    { email: 'systemadmin@dswd.gov.ph', uid: 'TEST_DATA_RUNNER' }
  )
}

function seedTestLoginAccountsForAllOffices() {
  return TestDataService.seedAccounts(
    { officeIds: 'all' },
    { email: 'systemadmin@dswd.gov.ph', uid: 'TEST_ACCOUNT_RUNNER' }
  )
}

function cleanupTestLoginAccountsForAllOffices() {
  return TestDataService.cleanupAccounts(
    { officeIds: 'all', confirm: 'DELETE_TEST_ACCOUNTS' },
    { email: 'systemadmin@dswd.gov.ph', uid: 'TEST_ACCOUNT_RUNNER' }
  )
}
