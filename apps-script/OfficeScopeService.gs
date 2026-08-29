const OfficeScopeService = (() => {
  // Resources whose WORKING DATA lives in the per-office workbook. Listing a
  // resource here redirects its entire request - every sheet read and write -
  // into that office's spreadsheet.
  //
  // Shared system configuration is deliberately NOT listed: OfficeRegistry,
  // OfficeOrgOptions, RaterMatrix and Users live only in the central PMES
  // database, keyed by officeId. 'rater-matrix' WAS listed here and that was
  // the bug: an office admin's request was redirected into their own
  // workbook, where the RaterMatrix tab does not exist, so saved rows were
  // invisible and a seed wrote a shadow matrix nobody else could see, while a
  // central admin (unscoped) read and wrote the real central table. The two
  // never saw each other's data.
  //
  // Services that own central config now bind to it explicitly via
  // SpreadsheetService.withCentralSpreadsheet, so they stay correct even when
  // called from inside a scoped request (e.g. assignment generation, which is
  // legitimately office-scoped but must read the central rater matrix).
  const SCOPED_RESOURCES = [
    'assessment-categories',
    'assessment-content',
    'assessment-rules',
    'ipat',
    'ipat-assignments',
    'notifications',
    'audit',
    'portal'
  ]

  function isAssessmentScopedResource(resource) {
    return SCOPED_RESOURCES.indexOf(String(resource || '')) >= 0
  }

  function run(resource, params, user, work) {
    if (!isAssessmentScopedResource(resource)) return work()

    const profile = AuthService.getProfile(user)
    if (!profile.accessConfigurationValid) {
      throw HttpError('Your office and system scope are incomplete. Contact a central administrator to complete your access assignment.', 403)
    }
    const targetOfficeId = resolveTargetOfficeId_(profile, params || {})
    if (!targetOfficeId || isStbOffice_(targetOfficeId, profile)) return work()

    const officeSpreadsheet = OfficeRegistryService.getSpreadsheetForOffice(targetOfficeId, user)
    return SpreadsheetService.withSpreadsheet(officeSpreadsheet, work)
  }

  function resolveTargetOfficeId_(profile, params) {
    const explicitOfficeId = String(params.officeId || params.officeCode || '').trim()
    if (explicitOfficeId && canUseExplicitOffice_(profile)) return explicitOfficeId

    const scope = String(profile.systemScope || 'STB_FULL')
    if (scope === 'STB_FULL' || scope === 'CLUSTER_ADMIN') return ''
    return String(profile.officeId || profile.officeCode || '').trim()
  }

  function canUseExplicitOffice_(profile) {
    return AuthService.hasPermission(profile, 'view_cluster_monitoring') ||
      AuthService.hasPermission(profile, 'manage_office_registry') ||
      AuthService.hasPermission(profile, 'provision_office_spreadsheets')
  }

  function isStbOffice_(officeId, profile) {
    const officeKey = String(officeId || '').trim().toUpperCase()
    return !officeKey ||
      officeKey === 'STB' ||
      officeKey === 'OFF-STB' ||
      (String(profile.systemScope || '') === 'STB_FULL' && !officeKey)
  }

  return {
    isAssessmentScopedResource,
    run
  }
})()
