const OfficeScopeService = (() => {
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
