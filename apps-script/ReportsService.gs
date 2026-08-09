/**
 * ReportsService.gs
 * ─────────────────────────────────────────────────────────────────────────────
 * Report generation and export for PMES.
 *
 * Previously the `reports/*` routes were 501-guarded while ReportsView.vue was
 * already live in the navigation, so every control on that page failed. This
 * service implements the six report types the view offers.
 *
 * Report types (must match the <select> in ReportsView.vue):
 *   ipcrf-summary        Per-person IPCRF accomplishment summary
 *   ccef-summary         Per-person CCEF target summary
 *   division-performance Division roll-up of target completion
 *   semestral            Final numerical/adjectival ratings per semester
 *   delayed              Accomplishments still outstanding past their deadline
 *   bureau-analytics     Cluster/bureau-wide aggregate incl. IPAT scores
 *
 * Formats:
 *   csv    built in memory and returned to the browser — no file is persisted
 *   excel  written to a Google Sheet in the PMES/Reports Drive folder
 *   pdf    same, exported to PDF; the intermediate sheet is trashed
 *
 * Access control mirrors DashboardService: a user needs division monitoring at
 * minimum, and anyone without `view_bureau_monitoring` is hard-scoped to their
 * own divisionId regardless of the divisionId they ask for. Report payloads
 * carry other personnel's performance data, so scoping is enforced here on the
 * server and never trusted from the request.
 */

const ReportsService = (() => {

  const REPORT_TYPES = {
    'ipcrf-summary':        'IPCRF Accomplishment Summary',
    'ccef-summary':         'CCEF Targets Summary',
    'division-performance': 'Division Performance Report',
    'semestral':            'Semestral Performance Report',
    'delayed':              'Delayed Submission Report',
    'bureau-analytics':     'Bureau-Wide Analytics',
    'undersecretary-analytics': 'Undersecretary Analytics Annex'
  }

  const FORMATS = ['csv', 'excel', 'pdf']

  // Reports that aggregate across every division require bureau-level access.
  const BUREAU_ONLY_TYPES = ['bureau-analytics']

  // The Reports tab is declared in InitSheets.gs but is NOT present in the live
  // production spreadsheet (verified 2026-08-04: 20 tabs exist, Reports is not
  // among them). SpreadsheetService.getSheet throws on a missing tab, so create
  // it on demand rather than making the whole module depend on someone having
  // remembered to re-run initializeSheets(). Headers match InitSheets.gs exactly.
  const REPORT_COLUMNS = [
    'id', 'name', 'type', 'divisionId', 'semester', 'year',
    'officeId', 'scopeLabel', 'format', 'driveFileId', 'driveUrl', 'generatedBy', 'generatedAt'
  ]

  function ensureReportsSheet() {
    const ss = SpreadsheetService.getSpreadsheet()
    let sheet = ss.getSheetByName(SHEET.REPORTS)

    if (!sheet) {
      sheet = ss.insertSheet(SHEET.REPORTS)
      sheet.getRange(1, 1, 1, REPORT_COLUMNS.length)
        .setValues([REPORT_COLUMNS])
        .setBackground('#0D2137')
        .setFontColor('#FFFFFF')
        .setFontWeight('bold')
        .setFontSize(10)
      sheet.setFrozenRows(1)
      Logger.log('[Reports] Created missing "' + SHEET.REPORTS + '" sheet.')
      return sheet
    }

    // Existing tab — append any missing columns without touching data, the same
    // additive contract initializeSheets() uses.
    const lastCol  = Math.max(sheet.getLastColumn(), 1)
    const existing = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h).trim())
    const missing  = REPORT_COLUMNS.filter(c => existing.indexOf(c) < 0)
    if (missing.length) {
      sheet.getRange(1, existing.length + 1, 1, missing.length).setValues([missing])
      Logger.log('[Reports] Added missing columns: ' + missing.join(', '))
    }
    return sheet
  }

  // ── Access helpers ────────────────────────────────────────────────────────

  function _requireReportAccess(user) {
    const profile = AuthService.getProfile(user)
    const canBureau   = AuthService.hasPermission(profile, 'view_bureau_monitoring')
    const canDivision = AuthService.hasPermission(profile, 'view_division_monitoring')
    const canCluster  = _canViewClusterReports(profile)
    const canOffice   = _isOfficeAdminProfile(profile)
    if (!canBureau && !canDivision && !canCluster && !canOffice) {
      throw HttpError('You do not have permission to generate reports.', 403)
    }
    return { profile, canBureau, canDivision, canCluster, canOffice }
  }

  function _canViewClusterReports(profile) {
    return String(profile.role || '') === 'System Administrator' ||
      AuthService.hasPermission(profile, 'view_cluster_monitoring') ||
      AuthService.hasPermission(profile, 'manage_office_registry') ||
      AuthService.hasPermission(profile, 'manage_cluster_office_admins')
  }

  function _isOfficeAdminProfile(profile) {
    return String(profile.systemScope || '') === 'OFFICE_ADMIN' ||
      String(profile.officeRole || '') === 'OFFICE_ADMIN'
  }

  /**
   * Resolve which division the report may cover.
   * Bureau-level users may pass any divisionId, or '' for all divisions.
   * Everyone else is forced to their own division, whatever they requested.
   */
  function _resolveDivisionScope(requestedDivisionId, profile, canBureau) {
    if (canBureau) return String(requestedDivisionId || '')
    return String(profile.divisionId || '')
  }

  function _scopeRows(rows, divisionId) {
    if (!divisionId) return rows
    return rows.filter(r => String(r.divisionId || '') === String(divisionId))
  }

  // ── CSV helpers ───────────────────────────────────────────────────────────

  // Values off a sheet can be numbers, booleans or Dates, so coerce before
  // escaping. (AuditService.export_ assumes strings and will throw on a Date.)
  function _csvCell(value) {
    if (value === null || value === undefined) return '""'
    const str = (value instanceof Date) ? value.toISOString() : String(value)
    return '"' + str.replace(/"/g, '""') + '"'
  }

  function _toCsv(columns, rows) {
    const lines = [columns.map(c => _csvCell(c.label)).join(',')]
    rows.forEach(row => {
      lines.push(columns.map(c => _csvCell(row[c.key])).join(','))
    })
    return lines.join('\n')
  }

  // ── Dataset builders ──────────────────────────────────────────────────────
  // Each returns { columns: [{key,label}], rows: [{...}] }

  function _buildIpcrfSummary(filters) {
    const forms = _periodFilter(
      _scopeRows(
        SpreadsheetService.getAllRows(SpreadsheetService.getSheet(SHEET.IPCRF_FORMS)),
        filters.divisionId
      ),
      filters
    ).filter(f => String(f.type || 'IPCRF').toUpperCase() !== 'CCEF')

    const entries = SpreadsheetService.getAllRows(SpreadsheetService.getSheet(SHEET.FORM_ENTRIES))
    const entriesByForm = {}
    entries.forEach(e => {
      const key = String(e.formId || '')
      if (!entriesByForm[key]) entriesByForm[key] = []
      entriesByForm[key].push(e)
    })

    const rows = forms.map(f => {
      const own       = entriesByForm[String(f.id)] || []
      const withAcc   = own.filter(e => String(e.accomplishment || '').trim()).length
      const withRatng = own.filter(e => e.ratingAverage !== '' && e.ratingAverage !== null && e.ratingAverage !== undefined).length
      return {
        employeeName:      f.employeeName,
        position:          f.position,
        divisionName:      f.divisionName,
        sectionName:       f.sectionName,
        semester:          f.semester,
        year:              f.year,
        status:            f.status,
        totalTargets:      own.length,
        withAccomplishment: withAcc,
        rated:             withRatng,
        finalNumericalRating: f.finalNumericalRating,
        adjectivalRating:  f.adjectivalRating,
        submittedAt:       f.submittedAt,
        finalizedAt:       f.finalizedAt
      }
    })

    return {
      columns: [
        { key: 'employeeName',         label: 'Employee' },
        { key: 'position',             label: 'Position' },
        { key: 'divisionName',         label: 'Division' },
        { key: 'sectionName',          label: 'Section' },
        { key: 'semester',             label: 'Semester' },
        { key: 'year',                 label: 'Year' },
        { key: 'status',               label: 'Status' },
        { key: 'totalTargets',         label: 'Total Targets' },
        { key: 'withAccomplishment',   label: 'With Accomplishment' },
        { key: 'rated',                label: 'Rated Entries' },
        { key: 'finalNumericalRating', label: 'Final Numerical Rating' },
        { key: 'adjectivalRating',     label: 'Adjectival Rating' },
        { key: 'submittedAt',          label: 'Submitted At' },
        { key: 'finalizedAt',          label: 'Finalized At' }
      ],
      rows
    }
  }

  function _buildCcefSummary(filters) {
    const forms = _periodFilter(
      _scopeRows(
        SpreadsheetService.getAllRows(SpreadsheetService.getSheet(SHEET.IPCRF_FORMS)),
        filters.divisionId
      ),
      filters
    ).filter(f => String(f.type || '').toUpperCase() === 'CCEF')

    const entries = SpreadsheetService.getAllRows(SpreadsheetService.getSheet(SHEET.FORM_ENTRIES))
    const formIds = {}
    forms.forEach(f => { formIds[String(f.id)] = f })

    const rows = entries
      .filter(e => formIds[String(e.formId)])
      .map(e => {
        const f = formIds[String(e.formId)]
        return {
          employeeName:     f.employeeName,
          divisionName:     f.divisionName,
          semester:         f.semester,
          year:             f.year,
          functionType:     e.functionType,
          kraName:          e.kraName,
          successIndicator: e.successIndicator,
          weight:           e.weight,
          classification:   e.classification,
          meansOfVerification: e.meansOfVerification,
          formStatus:       f.status
        }
      })

    return {
      columns: [
        { key: 'employeeName',        label: 'Employee' },
        { key: 'divisionName',        label: 'Division' },
        { key: 'semester',            label: 'Semester' },
        { key: 'year',                label: 'Year' },
        { key: 'functionType',        label: 'Function Type' },
        { key: 'kraName',             label: 'KRA' },
        { key: 'successIndicator',    label: 'Success Indicator' },
        { key: 'weight',              label: 'Weight' },
        { key: 'classification',      label: 'Classification' },
        { key: 'meansOfVerification', label: 'Means of Verification' },
        { key: 'formStatus',          label: 'Form Status' }
      ],
      rows
    }
  }

  function _buildDivisionPerformance(filters) {
    let divisions = SpreadsheetService.getAllRows(SpreadsheetService.getSheet(SHEET.DIVISIONS))
    if (filters.divisionId) {
      divisions = divisions.filter(d => String(d.id) === String(filters.divisionId))
    }

    const accs = _periodFilter(
      SpreadsheetService.getAllRows(SpreadsheetService.getSheet(SHEET.ACCOMPLISHMENTS))
        .filter(r => !r.deleted),
      filters
    )

    const rows = divisions.map(div => {
      const own       = accs.filter(a => String(a.divisionId || '') === String(div.id))
      const completed = own.filter(a => ['Completed', 'Approved'].includes(a.status)).length
      const delayed   = own.filter(a => a.status === 'Delayed').length
      const pending   = own.filter(a => a.status === 'Submitted').length
      return {
        divisionName:   div.name,
        divisionCode:   div.code,
        totalTargets:   own.length,
        completed,
        pending,
        delayed,
        completionRate: own.length ? Math.round((completed / own.length) * 100) : 0
      }
    })

    return {
      columns: [
        { key: 'divisionName',   label: 'Division' },
        { key: 'divisionCode',   label: 'Code' },
        { key: 'totalTargets',   label: 'Total Targets' },
        { key: 'completed',      label: 'Completed' },
        { key: 'pending',        label: 'Pending' },
        { key: 'delayed',        label: 'Delayed' },
        { key: 'completionRate', label: 'Completion Rate (%)' }
      ],
      rows
    }
  }

  function _buildSemestral(filters) {
    const forms = _periodFilter(
      _scopeRows(
        SpreadsheetService.getAllRows(SpreadsheetService.getSheet(SHEET.IPCRF_FORMS)),
        filters.divisionId
      ),
      filters
    )

    const ipat = SpreadsheetService.getAllRows(SpreadsheetService.getSheet(SHEET.IPAT_RECORDS))
    const ipatByForm = {}
    ipat.forEach(r => {
      if (r.ipcrfFormId) ipatByForm[String(r.ipcrfFormId)] = r
    })

    const rows = forms.map(f => {
      const linked = ipatByForm[String(f.id)] || {}
      return {
        employeeName:         f.employeeName,
        position:             f.position,
        divisionName:         f.divisionName,
        semester:             f.semester,
        year:                 f.year,
        status:               f.status,
        finalNumericalRating: f.finalNumericalRating,
        adjectivalRating:     f.adjectivalRating,
        ipatCbcScore:         linked.cbcScore || '',
        ipatFpoScore:         linked.fpoScore || '',
        ipatJfScore:          linked.jfScore || '',
        ipatOverallScore:     linked.overallScore || '',
        ipatDescriptor:       linked.descriptor || ''
      }
    })

    return {
      columns: [
        { key: 'employeeName',         label: 'Employee' },
        { key: 'position',             label: 'Position' },
        { key: 'divisionName',         label: 'Division' },
        { key: 'semester',             label: 'Semester' },
        { key: 'year',                 label: 'Year' },
        { key: 'status',               label: 'IPCRF Status' },
        { key: 'finalNumericalRating', label: 'IPCRF Final Rating' },
        { key: 'adjectivalRating',     label: 'IPCRF Adjectival' },
        { key: 'ipatCbcScore',         label: 'IPAT CBC' },
        { key: 'ipatFpoScore',         label: 'IPAT FPO' },
        { key: 'ipatJfScore',          label: 'IPAT JF' },
        { key: 'ipatOverallScore',     label: 'IPAT Overall' },
        { key: 'ipatDescriptor',       label: 'IPAT Descriptor' }
      ],
      rows
    }
  }

  function _buildDelayed(filters) {
    const rows = _periodFilter(
      _scopeRows(
        SpreadsheetService.getAllRows(SpreadsheetService.getSheet(SHEET.ACCOMPLISHMENTS))
          .filter(r => !r.deleted),
        filters.divisionId
      ),
      filters
    )
      .filter(a => a.status === 'Delayed' || (a.status === 'Not Started' && a.submittedAt === ''))
      .map(a => ({
        employeeName: a.employeeName,
        division:     a.division,
        semester:     a.semester,
        year:         a.year,
        kraTitle:     a.kraTitle,
        target:       a.target,
        status:       a.status,
        submittedAt:  a.submittedAt,
        remarks:      a.remarks
      }))

    return {
      columns: [
        { key: 'employeeName', label: 'Employee' },
        { key: 'division',     label: 'Division' },
        { key: 'semester',     label: 'Semester' },
        { key: 'year',         label: 'Year' },
        { key: 'kraTitle',     label: 'KRA' },
        { key: 'target',       label: 'Target' },
        { key: 'status',       label: 'Status' },
        { key: 'submittedAt',  label: 'Submitted At' },
        { key: 'remarks',      label: 'Remarks' }
      ],
      rows
    }
  }

  function _buildBureauAnalytics(filters) {
    const users = SpreadsheetService.getAllRows(SpreadsheetService.getSheet(SHEET.USERS))
      .filter(u => u.active === true)
    const divisions = SpreadsheetService.getAllRows(SpreadsheetService.getSheet(SHEET.DIVISIONS))
    const forms = _periodFilter(
      SpreadsheetService.getAllRows(SpreadsheetService.getSheet(SHEET.IPCRF_FORMS)),
      filters
    )
    const ipat = _periodFilter(
      SpreadsheetService.getAllRows(SpreadsheetService.getSheet(SHEET.IPAT_RECORDS)),
      filters
    )

    const rows = divisions.map(div => {
      const divUsers = users.filter(u => String(u.divisionId || '') === String(div.id))
      const divForms = forms.filter(f => String(f.divisionId || '') === String(div.id))
      const divIpat  = ipat.filter(r => String(r.divisionId || '') === String(div.id))

      const finalized = divForms.filter(f => f.status === 'Finalized').length
      const ipatScored = divIpat.filter(r => Number(r.overallScore) > 0)
      const avgIpat = ipatScored.length
        ? Math.round((ipatScored.reduce((s, r) => s + Number(r.overallScore), 0) / ipatScored.length) * 100) / 100
        : ''

      return {
        divisionName:      div.name,
        personnelCount:    divUsers.length,
        ipcrfForms:        divForms.length,
        ipcrfFinalized:    finalized,
        ipcrfCompletion:   divForms.length ? Math.round((finalized / divForms.length) * 100) : 0,
        ipatRecords:       divIpat.length,
        ipatScored:        ipatScored.length,
        ipatAverageOverall: avgIpat
      }
    })

    return {
      columns: [
        { key: 'divisionName',       label: 'Division' },
        { key: 'personnelCount',     label: 'Active Personnel' },
        { key: 'ipcrfForms',         label: 'IPCRF Forms' },
        { key: 'ipcrfFinalized',     label: 'Finalized' },
        { key: 'ipcrfCompletion',    label: 'IPCRF Completion (%)' },
        { key: 'ipatRecords',        label: 'IPAT Records' },
        { key: 'ipatScored',         label: 'IPAT Scored' },
        { key: 'ipatAverageOverall', label: 'IPAT Average Overall' }
      ],
      rows
    }
  }

  function _buildUndersecretaryAnalytics(filters) {
    const scopes = _assessmentReportScopes(filters)
    scopes.forEach(scope => { scope.filters = filters })
    const rows = []
    let allPersonnel = []
    let allRecords = []
    let allAssignments = []

    scopes.forEach(scope => {
      const data = _readAssessmentScope(scope)
      allPersonnel = allPersonnel.concat(data.personnel)
      allRecords = allRecords.concat(data.records)
      allAssignments = allAssignments.concat(data.assignments)
      rows.push(_summaryMetricRow(scope.label, 'Office Summary', 'Personnel', data.personnel.length, '', '', '', '', '', 'Active and registered personnel in scope.'))
      rows.push(_summaryMetricRow(scope.label, 'Office Summary', 'Assessment Records', data.records.length, '', '', '', '', '', 'Assessment records for selected period.'))
      rows.push(_summaryMetricRow(scope.label, 'Office Summary', 'Scored Assessments', _scoredRows(data.records).length, _percent(_scoredRows(data.records).length, data.records.length), _avg(data.records, 'overallScore'), _avg(data.records, 'cbcScore'), _avg(data.records, 'fpoScore'), _avg(data.records, 'jfScore'), 'Completed/scored assessment records.'))
      rows.push(_summaryMetricRow(scope.label, 'Office Summary', 'Pending Rater Assignments', data.assignments.filter(r => String(r.status || 'Pending') !== 'Completed').length, _percent(data.assignments.filter(r => String(r.status || 'Pending') !== 'Completed').length, data.assignments.length), '', '', '', '', 'Assignments not yet completed.'))
    })

    const scored = _scoredRows(allRecords)
    rows.unshift(_summaryMetricRow('Innovation Cluster', 'Executive Summary', 'Participating Offices/Programs', scopes.length, '', '', '', '', '', 'Includes STB central PMES and registered office/program portals in scope.'))
    rows.unshift(_summaryMetricRow('Innovation Cluster', 'Executive Summary', 'Scored Assessments', scored.length, _percent(scored.length, allRecords.length), _avg(allRecords, 'overallScore'), _avg(allRecords, 'cbcScore'), _avg(allRecords, 'fpoScore'), _avg(allRecords, 'jfScore'), 'Cluster-level scored assessment rate and domain averages.'))
    rows.unshift(_summaryMetricRow('Innovation Cluster', 'Executive Summary', 'Assessment Records', allRecords.length, '', '', '', '', '', 'All assessment records for selected period.'))
    rows.unshift(_summaryMetricRow('Innovation Cluster', 'Executive Summary', 'Personnel Covered', allPersonnel.length, '', '', '', '', '', 'Personnel in the included offices/programs.'))

    _interpretationLabels().forEach(label => {
      const count = scored.filter(r => _descriptor(r) === label).length
      rows.push(_summaryMetricRow('Innovation Cluster', 'Interpretation Distribution', label, count, _percent(count, scored.length), _avg(scored.filter(r => _descriptor(r) === label), 'overallScore'), '', '', '', 'Number and percentage per interpretation score.'))
    })

    scopes.forEach(scope => {
      const data = _readAssessmentScope(scope)
      const officeScored = _scoredRows(data.records)
      _interpretationLabels().forEach(label => {
        const count = officeScored.filter(r => _descriptor(r) === label).length
        rows.push(_summaryMetricRow(scope.label, 'Interpretation by Office', label, count, _percent(count, officeScored.length), _avg(officeScored.filter(r => _descriptor(r) === label), 'overallScore'), '', '', '', 'Office/program interpretation distribution.'))
      })
    })

    rows.push(_summaryMetricRow('Innovation Cluster', 'Domain Average', 'Core Behavioral Competencies', _scoreCount(allRecords, 'cbcScore'), '', '', _avg(allRecords, 'cbcScore'), '', '', 'Average CBC score across scoped records.'))
    rows.push(_summaryMetricRow('Innovation Cluster', 'Domain Average', 'Functional Performance Output', _scoreCount(allRecords, 'fpoScore'), '', '', '', _avg(allRecords, 'fpoScore'), '', 'Average FPO score across scoped records.'))
    rows.push(_summaryMetricRow('Innovation Cluster', 'Domain Average', 'Job Fitness', _scoreCount(allRecords, 'jfScore'), '', '', '', '', _avg(allRecords, 'jfScore'), 'Average JF score across scoped records.'))
    rows.push(_summaryMetricRow('Innovation Cluster', 'Domain Average', 'Overall IPAT', scored.length, '', _avg(allRecords, 'overallScore'), '', '', '', 'Average overall assessment score.'))

    return {
      columns: [
        { key: 'scope', label: 'Scope' },
        { key: 'section', label: 'Annex Section' },
        { key: 'metric', label: 'Metric' },
        { key: 'count', label: 'Count' },
        { key: 'percent', label: 'Percentage' },
        { key: 'overallAverage', label: 'Overall Average' },
        { key: 'cbcAverage', label: 'CBC Average' },
        { key: 'fpoAverage', label: 'FPO Average' },
        { key: 'jfAverage', label: 'JF Average' },
        { key: 'notes', label: 'Notes' }
      ],
      rows
    }
  }

  function _assessmentReportScopes(filters) {
    const profile = filters.profile || {}
    if (_isOfficeAdminProfile(profile) && !_canViewClusterReports(profile)) {
      const officeId = String(profile.officeId || profile.officeCode || '').trim()
      if (!officeId || officeId.toUpperCase() === 'STB') {
        throw HttpError('Office analytics require an assigned office/program.', 400)
      }
      const row = _findOfficeRegistryRow(officeId)
      if (!row) throw HttpError('Your assigned office/program is not registered for analytics.', 404)
      return [_officeScopeFromRegistryRow(row, filters.user, false)]
    }

    if (!_canViewClusterReports(profile) && !AuthService.hasPermission(profile, 'view_bureau_monitoring')) {
      throw HttpError('This analytics report requires office administrator or central monitoring access.', 403)
    }

    const scopes = [{
      id: 'STB',
      code: 'STB',
      label: 'Social Technology Bureau',
      central: true
    }]
    _activeOfficeRegistryRows().forEach(row => scopes.push(_officeScopeFromRegistryRow(row, filters.user, true)))
    return scopes
  }

  function _readAssessmentScope(scope) {
    const empty = { personnel: [], records: [], assignments: [] }
    try {
      if (scope.central) {
        return {
          personnel: _safeRows(SHEET.USERS).filter(_isActivePersonnelRow),
          records: _periodFilter(_safeRows(SHEET.IPAT_RECORDS), scope.filters || {}),
          assignments: _periodFilter(_safeRows(SHEET.IPAT_ASSIGNMENTS), scope.filters || {})
        }
      }
      if (!scope.spreadsheetId) throw new Error('Office spreadsheet is not registered.')
      const data = SpreadsheetService.withSpreadsheetId(scope.spreadsheetId, () => ({
        personnel: _safeRows('Personnel').filter(_isActivePersonnelRow),
        records: _periodFilter(_safeRows('AssessmentRecords'), scope.filters || {}),
        assignments: _periodFilter(_safeRows('RaterAssignments'), scope.filters || {})
      }))
      return data
    } catch (e) {
      Logger.log('[Reports] Could not read assessment scope ' + scope.label + ': ' + (e && e.message || e))
      return empty
    }
  }

  function _officeScopeFromRegistryRow(row, user, centralAccess) {
    if (!centralAccess) {
      OfficeRegistryService.getSpreadsheetForOffice(row.officeId, user)
    }
    return {
      id: row.officeId,
      code: row.officeCode,
      label: row.officeName || row.officeCode,
      central: false,
      spreadsheetId: row.spreadsheetId || ''
    }
  }

  function _activeOfficeRegistryRows() {
    return _safeRows(SHEET.OFFICE_REGISTRY)
      .filter(row =>
        String(row.officeStatus || '').toUpperCase() === 'ACTIVE' &&
        String(row.spreadsheetStatus || '').toUpperCase() === 'ACTIVE' &&
        String(row.officeId || row.officeCode || '').toUpperCase() !== 'STB'
      )
      .sort((a, b) => String(a.officeName || a.officeCode).localeCompare(String(b.officeName || b.officeCode)))
  }

  function _findOfficeRegistryRow(idOrCode) {
    const key = String(idOrCode || '').trim().toUpperCase()
    return _safeRows(SHEET.OFFICE_REGISTRY).find(row =>
      String(row.officeId || '').toUpperCase() === key ||
      String(row.officeCode || '').toUpperCase() === key ||
      String(row.id || '').toUpperCase() === key
    ) || null
  }

  function _safeRows(sheetName) {
    try {
      return SpreadsheetService.getAllRows(SpreadsheetService.getSheet(sheetName))
    } catch (e) {
      return []
    }
  }

  function _summaryMetricRow(scope, section, metric, count, percent, overallAverage, cbcAverage, fpoAverage, jfAverage, notes) {
    return {
      scope,
      section,
      metric,
      count,
      percent,
      overallAverage,
      cbcAverage,
      fpoAverage,
      jfAverage,
      notes
    }
  }

  function _scoredRows(rows) {
    return rows.filter(r => Number(r.overallScore) > 0)
  }

  function _scoreCount(rows, key) {
    return rows.filter(r => Number(r[key]) > 0).length
  }

  function _avg(rows, key) {
    const scored = rows.map(r => Number(r[key])).filter(v => Number.isFinite(v) && v > 0)
    return scored.length ? Math.round((scored.reduce((sum, value) => sum + value, 0) / scored.length) * 100) / 100 : ''
  }

  function _percent(count, total) {
    return total ? Math.round((Number(count || 0) / total) * 10000) / 100 + '%' : '0%'
  }

  function _descriptor(row) {
    const direct = String(row.descriptor || row.interpretation || '').trim()
    if (direct) return direct
    const score = Number(row.overallScore)
    if (score >= 4.00) return 'Outstanding'
    if (score >= 3.50) return 'Very Satisfactory'
    if (score >= 2.75) return 'Satisfactory'
    if (score >= 2.00) return 'Needs Improvement'
    if (score > 0) return 'Requires Immediate Intervention'
    return 'Unscored'
  }

  function _interpretationLabels() {
    return [
      'Outstanding',
      'Very Satisfactory',
      'Satisfactory',
      'Needs Improvement',
      'Requires Immediate Intervention'
    ]
  }

  function _isActivePersonnelRow(row) {
    return row.active === true ||
      String(row.active).toLowerCase() === 'true' ||
      String(row.status || '').toUpperCase() === 'ACTIVE' ||
      (!row.status && String(row.deleted || '').toLowerCase() !== 'true')
  }

  function _periodFilter(rows, filters) {
    let out = rows
    if (filters.semester) out = out.filter(r => String(r.semester) === String(filters.semester))
    if (filters.year)     out = out.filter(r => String(r.year) === String(filters.year))
    return out
  }

  const BUILDERS = {
    'ipcrf-summary':        _buildIpcrfSummary,
    'ccef-summary':         _buildCcefSummary,
    'division-performance': _buildDivisionPerformance,
    'semestral':            _buildSemestral,
    'delayed':              _buildDelayed,
    'bureau-analytics':     _buildBureauAnalytics,
    'undersecretary-analytics': _buildUndersecretaryAnalytics
  }

  // ── Drive output (excel / pdf) ────────────────────────────────────────────

  function _reportsFolder() {
    const rootId = PropertiesService.getScriptProperties().getProperty('DRIVE_ROOT_FOLDER_ID')
    const parent = rootId ? DriveApp.getFolderById(rootId) : DriveApp.getRootFolder()
    const existing = parent.getFoldersByName('Reports')
    return existing.hasNext() ? existing.next() : parent.createFolder('Reports')
  }

  /**
   * Writes the dataset to a Drive file and returns { driveFileId, driveUrl }.
   * The file inherits the folder's permissions — no link sharing is applied, so
   * exported personnel data is not made accessible by URL alone.
   */
  function _writeDriveFile(name, dataset, format) {
    const folder = _reportsFolder()
    const temp   = SpreadsheetApp.create(name)
    const sheet  = temp.getActiveSheet()

    const header = dataset.columns.map(c => c.label)
    const body   = dataset.rows.map(r => dataset.columns.map(c => {
      const v = r[c.key]
      return (v === null || v === undefined) ? '' : v
    }))

    sheet.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight('bold')
    if (body.length) {
      sheet.getRange(2, 1, body.length, header.length).setValues(body)
    }
    SpreadsheetApp.flush()

    const tempFile = DriveApp.getFileById(temp.getId())

    if (format === 'pdf') {
      const pdf = tempFile.getAs('application/pdf').setName(name + '.pdf')
      const out = folder.createFile(pdf)
      tempFile.setTrashed(true)
      return { driveFileId: out.getId(), driveUrl: out.getUrl() }
    }

    // excel — keep it as a Google Sheet in the Reports folder
    tempFile.moveTo(folder)
    return { driveFileId: tempFile.getId(), driveUrl: tempFile.getUrl() }
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /** GET reports — recent report metadata, scoped to what the caller may see. */
  function list(params, user) {
    const { profile, canBureau, canCluster } = _requireReportAccess(user)
    const sheet = ensureReportsSheet()

    let rows = SpreadsheetService.getAllRows(sheet)
      .sort((a, b) => new Date(b.generatedAt) - new Date(a.generatedAt))

    if (!canBureau && !canCluster) {
      if (_isOfficeAdminProfile(profile)) {
        rows = rows.filter(r => String(r.officeId || '').toUpperCase() === String(profile.officeId || profile.officeCode || '').toUpperCase())
      } else {
        // Division-level users see only reports covering their own division.
        rows = rows.filter(r => String(r.divisionId || '') === String(profile.divisionId || ''))
      }
    }

    // ReportsView renders r.createdAt and r.name; expose both names so the sheet
    // schema (generatedAt) and the view stay in sync without touching the view.
    const items = rows.slice(0, 20).map(r => ({
      ...r,
      createdAt:   r.generatedAt,
      downloadUrl: r.driveUrl || ''
    }))

    return { items, total: items.length }
  }

  /** POST reports/generate — build the dataset and return csv or a Drive URL. */
  function generate(body, user) {
    const { profile, canBureau, canCluster } = _requireReportAccess(user)

    const type = String(body.type || '')
    if (!REPORT_TYPES[type]) {
      throw HttpError('Unknown report type. Please choose a report from the list.', 400)
    }
    if (BUREAU_ONLY_TYPES.indexOf(type) >= 0 && !canBureau) {
      throw HttpError('This report requires bureau-wide monitoring access.', 403)
    }
    if (type === 'undersecretary-analytics' && !canBureau && !canCluster && !_isOfficeAdminProfile(profile)) {
      throw HttpError('This analytics report requires office administrator or central monitoring access.', 403)
    }

    let format = FORMATS.indexOf(String(body.format || '')) >= 0 ? String(body.format) : 'csv'
    if (type === 'undersecretary-analytics' && format === 'pdf') {
      format = 'excel'
    }
    const divisionId = _resolveDivisionScope(body.divisionId, profile, canBureau)
    const officeId = type === 'undersecretary-analytics' && _isOfficeAdminProfile(profile) && !canCluster
      ? String(profile.officeId || profile.officeCode || '').trim()
      : ''
    const scopeLabel = type === 'undersecretary-analytics'
      ? (officeId ? String(profile.officeName || officeId) : 'Innovation Cluster')
      : ''

    const filters = {
      divisionId,
      officeId,
      semester: body.semester ? String(body.semester) : '',
      year:     body.year     ? String(body.year)     : '',
      profile,
      user
    }

    const dataset = BUILDERS[type](filters)

    const label = REPORT_TYPES[type]
    const stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss')
    const name  = `${label} - S${filters.semester || 'All'} ${filters.year || 'All'} - ${stamp}`

    const record = {
      id:          SpreadsheetService.generateId('RPT-'),
      name,
      type,
      divisionId,
      officeId,
      scopeLabel,
      semester:    filters.semester,
      year:        filters.year,
      format,
      driveFileId: '',
      driveUrl:    '',
      generatedBy: profile.id,
      generatedAt: new Date().toISOString()
    }

    let payload = {}
    if (format === 'csv') {
      payload.csv = _toCsv(dataset.columns, dataset.rows)
    } else {
      try {
        const file = _writeDriveFile(name, dataset, format)
        record.driveFileId = file.driveFileId
        record.driveUrl    = file.driveUrl
        payload.downloadUrl = file.driveUrl
      } catch (e) {
        Logger.log('[Reports] Drive export failed for ' + type + ': ' + (e && e.message || e))
        if (type !== 'undersecretary-analytics') throw e
        record.format = 'csv'
        payload.csv = _toCsv(dataset.columns, dataset.rows)
        payload.exportFallback = 'csv'
      }
    }

    SpreadsheetService.appendRow(ensureReportsSheet(), record)

    AuditService.log('GENERATE_REPORT', 'Reports',
      `${label} (${format}) division=${divisionId || 'all'} semester=${filters.semester || 'all'} ` +
      `year=${filters.year || 'all'} rows=${dataset.rows.length}`, user)

    return {
      ...record,
      ...payload,
      createdAt: record.generatedAt,
      rowCount:  dataset.rows.length
    }
  }

  /** POST reports/preview - build an analytics preview without creating a file. */
  function preview(body, user) {
    const { profile, canBureau, canCluster } = _requireReportAccess(user)
    const type = String(body.type || 'undersecretary-analytics')
    if (type !== 'undersecretary-analytics') {
      throw HttpError('Analytics preview is available for the Undersecretary Analytics Annex.', 400)
    }
    if (!canBureau && !canCluster && !_isOfficeAdminProfile(profile)) {
      throw HttpError('This analytics preview requires office administrator or central monitoring access.', 403)
    }

    const divisionId = _resolveDivisionScope(body.divisionId, profile, canBureau)
    const officeId = _isOfficeAdminProfile(profile) && !canCluster
      ? String(profile.officeId || profile.officeCode || '').trim()
      : ''
    const filters = {
      divisionId,
      officeId,
      semester: body.semester ? String(body.semester) : '',
      year:     body.year     ? String(body.year)     : '',
      profile,
      user
    }
    const dataset = _buildUndersecretaryAnalytics(filters)
    return _buildUndersecretaryPreview_(dataset, {
      semester: filters.semester,
      year: filters.year,
      scopeLabel: officeId ? String(profile.officeName || officeId) : 'Innovation Cluster'
    })
  }

  function _buildUndersecretaryPreview_(dataset, meta) {
    const rows = dataset.rows || []
    const metric = (scope, section, name) => rows.find(row =>
      row.scope === scope &&
      row.section === section &&
      row.metric === name
    ) || {}
    const interpretationDistribution = _interpretationLabels().map(label => {
      const row = metric('Innovation Cluster', 'Interpretation Distribution', label)
      return {
        label,
        count: Number(row.count || 0),
        percent: row.percent || '0%',
        average: row.overallAverage || ''
      }
    })
    const domainRows = rows.filter(row => row.scope === 'Innovation Cluster' && row.section === 'Domain Average')
    const domainAverages = domainRows.map(row => ({
      label: row.metric,
      count: Number(row.count || 0),
      average: Number(row.overallAverage || row.cbcAverage || row.fpoAverage || row.jfAverage || 0)
    }))
    const officeNames = {}
    rows
      .filter(row => row.section === 'Office Summary')
      .forEach(row => { officeNames[row.scope] = true })
    const officeSummaries = Object.keys(officeNames).sort().map(scope => ({
      office: scope,
      personnel: Number((metric(scope, 'Office Summary', 'Personnel') || {}).count || 0),
      records: Number((metric(scope, 'Office Summary', 'Assessment Records') || {}).count || 0),
      scored: Number((metric(scope, 'Office Summary', 'Scored Assessments') || {}).count || 0),
      scoredPercent: (metric(scope, 'Office Summary', 'Scored Assessments') || {}).percent || '0%',
      pendingAssignments: Number((metric(scope, 'Office Summary', 'Pending Rater Assignments') || {}).count || 0),
      overallAverage: Number((metric(scope, 'Office Summary', 'Scored Assessments') || {}).overallAverage || 0)
    }))

    return {
      title: 'Undersecretary Analytics Annex',
      scopeLabel: meta.scopeLabel || 'Innovation Cluster',
      semester: meta.semester || 'All',
      year: meta.year || 'All',
      generatedAt: new Date().toISOString(),
      kpis: {
        personnel: Number((metric('Innovation Cluster', 'Executive Summary', 'Personnel Covered') || {}).count || 0),
        records: Number((metric('Innovation Cluster', 'Executive Summary', 'Assessment Records') || {}).count || 0),
        scored: Number((metric('Innovation Cluster', 'Executive Summary', 'Scored Assessments') || {}).count || 0),
        scoredPercent: (metric('Innovation Cluster', 'Executive Summary', 'Scored Assessments') || {}).percent || '0%',
        offices: Number((metric('Innovation Cluster', 'Executive Summary', 'Participating Offices/Programs') || {}).count || 0),
        overallAverage: Number((metric('Innovation Cluster', 'Executive Summary', 'Scored Assessments') || {}).overallAverage || 0),
        cbcAverage: Number((metric('Innovation Cluster', 'Executive Summary', 'Scored Assessments') || {}).cbcAverage || 0),
        fpoAverage: Number((metric('Innovation Cluster', 'Executive Summary', 'Scored Assessments') || {}).fpoAverage || 0),
        jfAverage: Number((metric('Innovation Cluster', 'Executive Summary', 'Scored Assessments') || {}).jfAverage || 0)
      },
      interpretationDistribution,
      domainAverages,
      officeSummaries
    }
  }

  /** GET reports/:id/download — resolve a previously generated report. */
  function download(id, user) {
    const { profile, canBureau, canCluster } = _requireReportAccess(user)
    const sheet = ensureReportsSheet()
    const row   = SpreadsheetService.getRow(sheet, id)
    if (!row) throw HttpError('Report not found', 404)

    if (!canBureau && !canCluster) {
      if (_isOfficeAdminProfile(profile)) {
        if (String(row.officeId || '').toUpperCase() !== String(profile.officeId || profile.officeCode || '').toUpperCase()) {
          throw HttpError('You do not have access to this report.', 403)
        }
      } else if (String(row.divisionId || '') !== String(profile.divisionId || '')) {
        throw HttpError('You do not have access to this report.', 403)
      }
    }

    if (row.driveUrl) {
      return { id: row.id, name: row.name, downloadUrl: row.driveUrl, format: row.format }
    }

    // CSV reports are not persisted as files — rebuild from the stored filters.
    const dataset = BUILDERS[row.type]({
      divisionId: String(row.divisionId || ''),
      officeId:   String(row.officeId || ''),
      semester:   String(row.semester || ''),
      year:       String(row.year || ''),
      profile,
      user
    })
    return {
      id:     row.id,
      name:   row.name,
      format: 'csv',
      csv:    _toCsv(dataset.columns, dataset.rows)
    }
  }

  /** Reference data for the report form — replaces the hard-coded division list. */
  function options(params, user) {
    const { profile, canBureau } = _requireReportAccess(user)
    let divisions = SpreadsheetService.getAllRows(SpreadsheetService.getSheet(SHEET.DIVISIONS))
      .filter(d => d.active !== false)
    if (!canBureau) {
      divisions = divisions.filter(d => String(d.id) === String(profile.divisionId || ''))
    }
    return {
      divisions: divisions
        .map(d => ({ id: d.id, name: d.name, code: d.code }))
        .sort((a, b) => String(a.name).localeCompare(String(b.name))),
      types: Object.keys(REPORT_TYPES)
        .filter(t => BUREAU_ONLY_TYPES.indexOf(t) < 0 || canBureau)
        .map(t => ({ value: t, label: REPORT_TYPES[t] })),
      formats: FORMATS,
      canSelectAllDivisions: canBureau
    }
  }

  return { list, generate, download, options, preview }
})()
