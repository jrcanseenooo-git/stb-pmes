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
  const permissions = computed(() => {
    const base = authStore.profile?.permissions || []
    if (!isOfficeAdminScope.value) return base
    return Array.from(new Set(base.concat([
      'manage_office_users',
      'generate_ipat_assignments',
      'manage_ipat_scores',
      'view_bureau_monitoring',
      'view_division_monitoring'
    ])))
  })
  const permissionGroups = computed(() => {
    const base = authStore.profile?.permissionGroups || []
    if (!isOfficeAdminScope.value) return base
    return Array.from(new Set(base.concat(['office-assessment-admin'])))
  })
  const isStbFullScope = computed(() => systemScope.value === 'STB_FULL')
  const isClusterPortalScope = computed(() => ['CLUSTER_PORTAL', 'OFFICE_ADMIN', 'CLUSTER_ADMIN'].includes(systemScope.value))

  const hasPermission = (permission) => computed(() =>
    permissions.value.includes(permission)
  )

  const isAdmin       = computed(() => role.value === 'System Administrator')
  const isDirector    = computed(() => role.value === 'Bureau Director')
  const isAsstDir     = computed(() => role.value === 'Assistant Bureau Director')
  const isDivChief    = computed(() => role.value === 'Division Chief')
  const isSectionHead = computed(() => role.value === 'Section Head')
  const isStaff       = computed(() => ['Staff', 'Technical Staff'].includes(role.value))

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
    authStore.profile?.systemScope === 'OFFICE_ADMIN' ||
    authStore.profile?.officeRole === 'OFFICE_ADMIN'
  )
  const canManageLibraries = computed(() =>
    permissions.value.includes('manage_libraries') ||
    permissions.value.includes('manage_assessment_content') ||
    isAdmin.value
  )
  const canManageFocalAssignments = computed(() => permissions.value.includes('manage_focal_assignments') || isAdmin.value)
  const canViewAudit = computed(() => permissions.value.includes('view_audit') || isAdmin.value || isDirector.value)
  const canGenerateReports = computed(() =>
    isAdmin.value ||
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
  const canViewClusterMonitoring = computed(() =>
    permissions.value.includes('view_cluster_monitoring')
  )
  // Gates the Rater Tagging screen. Mirrors the backend check in
  // RaterMatrixService.requireManage_ so the menu and the API agree.
  const canGenerateAssignments = computed(() =>
    permissions.value.includes('generate_ipat_assignments') ||
    permissions.value.includes('manage_office_registry')
  )
  const canManageOfficePersonnel = computed(() =>
    authStore.profile?.systemScope === 'OFFICE_ADMIN' ||
    authStore.profile?.officeRole === 'OFFICE_ADMIN' ||
    permissions.value.includes('manage_cluster_office_admins') ||
    permissions.value.includes('manage_office_registry')
  )
  const evaluationOnlyRollout = computed(() => {
    const mode = authStore.profile?.systemAccessMode
    if (mode) return mode !== 'full_access'
    return import.meta.env.VITE_EVALUATION_ONLY_ROLLOUT !== 'false'
  })
  const canAccessFullSystem = computed(() =>
    !evaluationOnlyRollout.value ||
    isAdmin.value ||
    permissions.value.includes('manage_users') ||
    permissions.value.includes('manage_focal_assignments') ||
    permissions.value.includes('manage_database') ||
    permissions.value.includes('manage_libraries') ||
    permissions.value.includes('manage_assessment_content') ||
    permissions.value.includes('manage_office_registry') ||
    permissions.value.includes('provision_office_spreadsheets') ||
    permissions.value.includes('view_cluster_monitoring') ||
    permissions.value.includes('view_audit') ||
    permissionGroups.value.includes('system-admin') ||
    permissionGroups.value.includes('user-manager') ||
    permissionGroups.value.includes('library-manager') ||
    permissionGroups.value.includes('database-manager')
  )
  const divisionScope = computed(() => {
    if (canViewAllDivisions.value) return null
    if (permissions.value.includes('view_division_monitoring') || isDivChief.value) return authStore.profile?.divisionId ?? null
    return authStore.profile?.divisionId ?? null
  })

  return {
    role, permissions, permissionGroups, hasPermission,
    systemScope, isStbFullScope, isClusterPortalScope, isOfficeAdminScope,
    isAdmin, isDirector, isAsstDir, isDivChief, isSectionHead, isStaff,
    canViewAllDivisions, canApprove, canManageUsers, canManageLibraries,
    canManageFocalAssignments, canViewAudit, canGenerateReports,
    canManageDatabase, canManageOfficeRegistry, canViewClusterMonitoring, canGenerateAssignments, canManageOfficePersonnel, canManageOfficeUsers,
    evaluationOnlyRollout, canAccessFullSystem, divisionScope
  }
}
