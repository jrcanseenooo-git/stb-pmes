import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth'

export function usePermissions() {
  const authStore = useAuthStore()
  const role      = computed(() => authStore.role)
  const permissions = computed(() => authStore.profile?.permissions || [])
  const permissionGroups = computed(() => authStore.profile?.permissionGroups || [])

  const hasPermission = (permission) => computed(() =>
    permissions.value.includes(permission)
  )

  const isAdmin       = computed(() => role.value === 'System Administrator')
  const isDirector    = computed(() => role.value === 'Bureau Director')
  const isAsstDir     = computed(() => role.value === 'Assistant Bureau Director')
  const isDivChief    = computed(() => role.value === 'Division Chief')
  const isSectionHead = computed(() => role.value === 'Section Head')
  const isStaff       = computed(() => role.value === 'Staff')

  const canViewAllDivisions = computed(() =>
    permissions.value.includes('view_bureau_monitoring') ||
    isAdmin.value ||
    isDirector.value ||
    isAsstDir.value
  )
  const canApprove = computed(() => isAdmin.value || isDirector.value || isAsstDir.value || isDivChief.value || isSectionHead.value)
  const canManageUsers = computed(() => permissions.value.includes('manage_users') || isAdmin.value)
  const canManageLibraries = computed(() =>
    permissions.value.includes('manage_libraries') ||
    permissions.value.includes('manage_assessment_content') ||
    isAdmin.value
  )
  const canManageFocalAssignments = computed(() => permissions.value.includes('manage_focal_assignments') || isAdmin.value)
  const canViewAudit = computed(() => permissions.value.includes('view_audit') || isAdmin.value || isDirector.value)
  const canGenerateReports = computed(() => isAdmin.value || isDirector.value || isAsstDir.value || isDivChief.value || isSectionHead.value)
  const canManageDatabase = computed(() => permissions.value.includes('manage_database') || isAdmin.value)
  const evaluationOnlyRollout = computed(() =>
    import.meta.env.VITE_EVALUATION_ONLY_ROLLOUT !== 'false'
  )
  const canAccessFullSystem = computed(() =>
    !evaluationOnlyRollout.value ||
    isAdmin.value ||
    permissions.value.includes('manage_users') ||
    permissions.value.includes('manage_focal_assignments') ||
    permissions.value.includes('manage_database') ||
    permissions.value.includes('manage_libraries') ||
    permissions.value.includes('manage_assessment_content') ||
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
    isAdmin, isDirector, isAsstDir, isDivChief, isSectionHead, isStaff,
    canViewAllDivisions, canApprove, canManageUsers, canManageLibraries,
    canManageFocalAssignments, canViewAudit, canGenerateReports,
    canManageDatabase, evaluationOnlyRollout, canAccessFullSystem, divisionScope
  }
}
