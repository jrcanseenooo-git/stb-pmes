import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth'

export function usePermissions() {
  const authStore = useAuthStore()
  const role      = computed(() => authStore.role)
  const systemScope = computed(() => authStore.profile?.systemScope || 'STB_FULL')
  const isOfficeAdminScope = computed(() =>
    systemScope.value === 'OFFICE_ADMIN' ||
    authStore.profile?.officeRole === 'OFFICE_ADMIN'
  )
  const isExplicitOfficeAdmin = computed(() =>
    authStore.profile?.officeRole === 'OFFICE_ADMIN' ||
    authStore.profile?.permissionGroups?.includes('office-assessment-admin') ||
    authStore.profile?.permissions?.includes('manage_office_users')
  )
  // The backend is the authority for permissions. Do not manufacture broader
  // client-side capabilities from an office-admin marker: doing so made the
  // interface disagree with server-side office boundaries.
  const permissions = computed(() => authStore.profile?.permissions || [])
  const permissionGroups = computed(() => authStore.profile?.permissionGroups || [])
  const isStbFullScope = computed(() => systemScope.value === 'STB_FULL')
  const isOfficeFullPmesScope = computed(() => systemScope.value === 'OFFICE_FULL_PMES')
  const isClusterPortalScope = computed(() =>
    ['CLUSTER_PORTAL', 'OFFICE_ADMIN', 'CLUSTER_ADMIN', 'OFFICE_FULL_PMES'].includes(systemScope.value)
  )

  const hasPermission = (permission) => computed(() =>
    permissions.value.includes(permission)
  )

  const isAdmin = computed(() => {
    if (role.value !== 'System Administrator') return false
    if (!['STB_FULL', 'CLUSTER_ADMIN'].includes(systemScope.value)) return false
    const officeKey = String(
      authStore.profile?.officeId ||
      authStore.profile?.officeCode ||
      authStore.profile?.officeName ||
      ''
    ).trim().toUpperCase()
    return !officeKey || officeKey === 'STB' || officeKey === 'SOCIAL TECHNOLOGY BUREAU'
  })
  const isStbSystemAdmin = computed(() => {
    if (!isAdmin.value || systemScope.value !== 'STB_FULL') return false
    const officeKey = String(
      authStore.profile?.officeId ||
      authStore.profile?.officeCode ||
      authStore.profile?.officeName ||
      'STB'
    ).trim().toUpperCase()
    return !officeKey || officeKey === 'STB' || officeKey === 'SOCIAL TECHNOLOGY BUREAU'
  })
  const isDirector    = computed(() => role.value === 'Bureau Director')
  const isAsstDir     = computed(() => role.value === 'Assistant Bureau Director')
  const isDivChief    = computed(() => role.value === 'Division Chief')
  const isSectionHead = computed(() => role.value === 'Section Head')
  const isStaff       = computed(() => ['Staff', 'Technical Staff'].includes(role.value))
  // Cluster oversight. Deliberately given a deliberately small menu: the
  // Undersecretary monitors the cluster and does not administer offices, and a
  // sidebar full of modules they never use makes the one they do need harder
  // to find.
  const isUndersecretary = computed(() => role.value === 'Undersecretary')

  const canViewAllDivisions = computed(() =>
    permissions.value.includes('view_bureau_monitoring') ||
    isAdmin.value ||
    isDirector.value ||
    isAsstDir.value
  )
  const canApprove = computed(() => isAdmin.value || isDirector.value || isAsstDir.value || isDivChief.value || isSectionHead.value)
  const canManageUsers = computed(() => permissions.value.includes('manage_users') || isAdmin.value)
  const canManageOfficeUsers = computed(() =>
    permissions.value.includes('manage_office_users') ||
    isExplicitOfficeAdmin.value
  )
  const canManageLibraries = computed(() =>
    permissions.value.includes('manage_libraries') ||
    permissions.value.includes('manage_assessment_content') ||
    isAdmin.value
  )
  const canViewAssessmentLibrary = computed(() => isAdmin.value)
  const canManageFocalAssignments = computed(() => permissions.value.includes('manage_focal_assignments') || isAdmin.value)
  const canViewAudit = computed(() => isStbSystemAdmin.value)
  const canGenerateReports = computed(() =>
    isStbSystemAdmin.value ||
    isDirector.value ||
    isAsstDir.value ||
    isDivChief.value ||
    isSectionHead.value ||
    permissions.value.includes('view_bureau_monitoring') ||
    permissions.value.includes('view_cluster_monitoring') ||
    permissions.value.includes('manage_office_users')
  )
  const canManageDatabase = computed(() => permissions.value.includes('manage_database') || isAdmin.value)
  const canManageOfficeRegistry = computed(() =>
    permissions.value.includes('manage_office_registry') ||
    permissions.value.includes('provision_office_spreadsheets') ||
    permissions.value.includes('validate_office_spreadsheets')
  )
  const canConfigureOfficeStructure = computed(() =>
    canManageOfficeRegistry.value ||
    canManageOfficeUsers.value
  )
  const canViewClusterMonitoring = computed(() =>
    permissions.value.includes('view_cluster_monitoring')
  )
  // Gates the Rater Tagging screen. Mirrors the backend check in
  // RaterMatrixService.requireManage_ and assignment-generation scope checks.
  // The delegated focal is still limited server-side to their assigned office.
  const canGenerateAssignments = computed(() =>
    permissions.value.includes('generate_ipat_assignments') ||
    permissions.value.includes('manage_office_rater_matrix') ||
    permissions.value.includes('manage_office_registry') ||
    isExplicitOfficeAdmin.value
  )
  const canManageOfficePersonnel = computed(() =>
    isExplicitOfficeAdmin.value ||
    permissions.value.includes('manage_cluster_office_admins') ||
    permissions.value.includes('manage_office_registry')
  )
  const canViewOfficeDashboard = computed(() =>
    canManageOfficePersonnel.value ||
    isDivChief.value ||
    isSectionHead.value ||
    permissions.value.includes('view_division_monitoring') ||
    permissions.value.includes('view_bureau_monitoring')
  )
  const canViewOfficePersonnel = computed(() =>
    !isStbFullScope.value && (
      canManageOfficePersonnel.value ||
      isDivChief.value ||
      isSectionHead.value ||
      permissions.value.includes('view_division_monitoring') ||
      permissions.value.includes('view_bureau_monitoring')
    )
  )
  const evaluationOnlyRollout = computed(() => {
    const mode = authStore.profile?.systemAccessMode
    if (mode) return mode !== 'full_access'
    return import.meta.env.VITE_EVALUATION_ONLY_ROLLOUT !== 'false'
  })
  // Full system access means the legacy STB module set (Dashboard, KRA,
  // IPCRF/CCEF, Accomplishments, Review) is available. In evaluation-only
  // mode, even STB_FULL profiles use the simplified evaluation portal; assigned
  // admin and monitoring abilities are still exposed by their own permission
  // checks below, but they do not implicitly reopen the STB-only modules.
  const canAccessFullSystem = computed(() => !evaluationOnlyRollout.value)
  const divisionScope = computed(() => {
    if (canViewAllDivisions.value) return null
    if (permissions.value.includes('view_division_monitoring') || isDivChief.value) return authStore.profile?.divisionId ?? null
    return authStore.profile?.divisionId ?? null
  })

  return {
    role, permissions, permissionGroups, hasPermission,
    systemScope, isStbFullScope, isOfficeFullPmesScope, isClusterPortalScope, isOfficeAdminScope, isExplicitOfficeAdmin,
    isAdmin, isStbSystemAdmin, isDirector, isAsstDir, isDivChief, isSectionHead, isStaff, isUndersecretary,
    canViewAllDivisions, canApprove, canManageUsers, canManageLibraries, canViewAssessmentLibrary,
    canManageFocalAssignments, canViewAudit, canGenerateReports,
    canManageDatabase, canManageOfficeRegistry, canConfigureOfficeStructure, canViewClusterMonitoring, canGenerateAssignments, canManageOfficePersonnel, canManageOfficeUsers,
    canViewOfficeDashboard, canViewOfficePersonnel,
    evaluationOnlyRollout, canAccessFullSystem, divisionScope
  }
}
