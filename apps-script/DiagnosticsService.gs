/**
 * DiagnosticsService.gs
 *
 * Read-only introspection of the multi-office data boundary.
 *
 * WHY THIS EXISTS
 * ---------------
 * When Rater Tagging or Office Structure looks empty for one office but not
 * another, the cause is almost never the screen - it is a mismatch between
 * three separate things that all have to agree:
 *
 *   1. which spreadsheet the request is actually bound to,
 *   2. which officeId the signed-in profile resolves to, and
 *   3. which officeId the stored config rows were written under.
 *
 * Guessing at those from the UI is what makes this class of bug expensive.
 * This endpoint reports all three side by side, for every office at once, so
 * a mismatch is visible rather than inferred.
 *
 * Strictly read-only: it opens spreadsheets and counts rows. It never writes,
 * seeds, repairs or migrates anything.
 */
const DiagnosticsService = (() => {

  function officeBoundary(params, user) {
    // Central config only - bind explicitly so the report describes the real
    // central tables even if this request arrived inside an office scope.
    return SpreadsheetService.withCentralSpreadsheet(() => {
      const profile = AuthService.getProfile(user)
      requireDiagnostics_(profile)

      const isCentral = isCentralProfile_(profile)
      const centralSpreadsheetId = SpreadsheetService.getSpreadsheetId()

      const registryRows = safeRows_(SHEET.OFFICE_REGISTRY || 'OfficeRegistry')
      const orgRows = safeRows_(SHEET.OFFICE_ORG_OPTIONS || 'OfficeOrgOptions')
      const matrixRows = safeRows_(RaterMatrixService.SHEET_NAME)

      const profileOfficeId = String(profile.officeId || profile.officeCode || '').trim()
      const resolvedOfficeId = profileOfficeId || 'STB'

      // An office admin only ever sees their own office; a central admin sees
      // every registered office so one call covers the whole cluster.
      // STB is not a registry row - it is the built-in central office - so it
      // has to be added explicitly or the report silently covers only 6 of 7.
      const stbOffice = {
        officeId: 'STB',
        officeCode: 'STB',
        officeName: 'Social Technology Bureau',
        officeStatus: 'ACTIVE',
        spreadsheetStatus: 'ACTIVE',
        hasSpreadsheet: true,
        isBuiltInCentral: true
      }

      const offices = isCentral
        ? [stbOffice].concat(registryRows.map(r => ({
            officeId: String(r.officeId || '').trim(),
            officeCode: String(r.officeCode || '').trim(),
            officeName: String(r.officeName || '').trim(),
            officeStatus: String(r.officeStatus || '').trim(),
            spreadsheetStatus: String(r.spreadsheetStatus || '').trim(),
            hasSpreadsheet: !!r.spreadsheetId
          })))
        : [{ officeId: resolvedOfficeId, officeCode: String(profile.officeCode || '').trim(), officeName: String(profile.officeName || '').trim() }]

      const perOffice = offices.map(office => {
        const keys = aliasKeySet_(office.officeId, office.officeCode, office.officeName)
        const orgForOffice = orgRows.filter(r => keys[normalizeKey_(r.officeId)])
        const matrixForOffice = matrixRows.filter(r => keys[normalizeKey_(r.officeId)])
        return {
          ...office,
          orgOptions: {
            divisions: countType_(orgForOffice, 'division'),
            sections: countType_(orgForOffice, 'section'),
            roles: countType_(orgForOffice, 'role'),
            total: orgForOffice.length
          },
          raterMatrixRows: matrixForOffice.length,
          raterMatrixRoles: distinct_(matrixForOffice.map(r => String(r.rateeRole || '').trim()).filter(Boolean)),
          officeWorkbook: isCentral ? officeWorkbookInfo_(office.officeId, user) : undefined
        }
      })

      return {
        caller: {
          email: profile.email || user.email || '',
          role: profile.role || '',
          systemScope: profile.systemScope || '',
          officeRole: profile.officeRole || '',
          profileOfficeId: profileOfficeId,
          profileOfficeCode: String(profile.officeCode || '').trim(),
          profileOfficeName: String(profile.officeName || '').trim(),
          resolvedOfficeId: resolvedOfficeId,
          isCentralAdmin: isCentral
        },
        centralSpreadsheetId: centralSpreadsheetId,
        offices: perOffice,
        // Raw distinct officeId values actually present in each central table.
        // This is the fastest way to spot an alias mismatch: if a row is filed
        // under a spelling no office resolves to, it shows up here and nowhere
        // in `offices`, which is exactly the invisible-rows failure mode.
        storedOfficeIds: {
          officeRegistry: tally_(registryRows.map(r => r.officeId)),
          officeOrgOptions: tally_(orgRows.map(r => r.officeId)),
          raterMatrix: tally_(matrixRows.map(r => r.officeId))
        },
        generatedAt: new Date().toISOString()
      }
    })
  }

  // ── helpers ───────────────────────────────────────────────────────────────

  function requireDiagnostics_(profile) {
    const ok = isCentralProfile_(profile) ||
      AuthService.hasPermission(profile, 'manage_office_users') ||
      AuthService.hasPermission(profile, 'generate_ipat_assignments') ||
      String(profile.officeRole || '').toUpperCase() === 'OFFICE_ADMIN'
    if (!ok) throw HttpError('Access denied. Administrator role required.', 403)
  }

  function isCentralProfile_(profile) {
    return AuthService.hasPermission(profile, 'manage_users') ||
      AuthService.hasPermission(profile, 'manage_office_registry') ||
      AuthService.hasPermission(profile, 'view_cluster_monitoring')
  }

  // Reports reachability without ever creating or modifying the workbook.
  function officeWorkbookInfo_(officeId, user) {
    const key = String(officeId || '').trim().toUpperCase()
    if (!key || key === 'STB') {
      return { spreadsheetId: '', note: 'STB uses the central PMES database.' }
    }
    try {
      const ss = OfficeRegistryService.getSpreadsheetForOffice(officeId, user)
      const personnel = SpreadsheetService.withSpreadsheet(ss, () => {
        const sheet = SpreadsheetService.findSheet('Personnel')
        return sheet ? SpreadsheetService.getAllRows(sheet).length : null
      })
      return {
        spreadsheetId: ss.getId ? ss.getId() : '',
        reachable: true,
        personnelRows: personnel,
        hasPersonnelTab: personnel !== null
      }
    } catch (e) {
      return { spreadsheetId: '', reachable: false, error: String(e && e.message || e) }
    }
  }

  function safeRows_(sheetName) {
    try {
      const sheet = SpreadsheetService.findSheet(sheetName)
      return sheet ? SpreadsheetService.getAllRows(sheet) : []
    } catch (e) {
      Logger.log('[Diagnostics] could not read ' + sheetName + ': ' + (e && e.message || e))
      return []
    }
  }

  function countType_(rows, type) {
    return rows.filter(r => String(r.optionType || '').trim().toLowerCase() === type).length
  }

  function distinct_(values) {
    const seen = {}
    const out = []
    values.forEach(v => { if (v && !seen[v]) { seen[v] = true; out.push(v) } })
    return out
  }

  function tally_(values) {
    const counts = {}
    values.forEach(v => {
      const key = String(v || '').trim() || '(blank)'
      counts[key] = (counts[key] || 0) + 1
    })
    return counts
  }

  function normalizeKey_(value) {
    return String(value || '').trim().toUpperCase().replace(/[!,.]/g, '').replace(/\s+/g, ' ')
  }

  // Mirrors the alias rules used by OfficeRegistryService/RaterMatrixService so
  // the report counts rows the same way the app resolves them.
  function aliasKeySet_(officeId, officeCode, officeName) {
    const seeds = [officeId, officeCode, officeName].map(v => String(v || '').trim()).filter(Boolean)
    const normalized = seeds.map(normalizeKey_)
    const values = seeds.slice()

    function hasAny(candidates) {
      return candidates.some(c => normalized.indexOf(normalizeKey_(c)) >= 0)
    }
    if (hasAny(['WGP', 'WALANG-GUTOM', 'WALANG GUTOM', 'WALANG GUTOM PROGRAM', 'OFF-WALANG-GUTOM'])) {
      values.push('WGP', 'OFF-WGP', 'WALANG-GUTOM', 'WALANG GUTOM PROGRAM', 'OFF-WALANG-GUTOM')
    }
    if (hasAny(['TBTP', 'TARA-BASA', 'TARA BASA', 'TARA BASA TUTORING PROGRAM', 'OFF-TARA-BASA'])) {
      values.push('TBTP', 'OFF-TBTP', 'TARA-BASA', 'TARA BASA TUTORING PROGRAM', 'OFF-TARA-BASA')
    }
    seeds.forEach(s => { if (s.indexOf('OFF-') !== 0) values.push('OFF-' + s) })

    const out = {}
    values.forEach(v => {
      const n = normalizeKey_(v)
      if (n) out[n] = true
    })
    return out
  }

  return { officeBoundary }
})()
