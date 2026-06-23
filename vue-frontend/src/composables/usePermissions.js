import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth'

export function usePermissions() {
  const authStore = useAuthStore()
  const role      = computed(() => authStore.role)

  const isAdmin       = computed(() => role.value === 'System Administrator')
  const isDirector    = computed(() => role.value === 'Bureau Director')
  const isAsstDir     = computed(() => role.value === 'Assistant Bureau Director')
  const isDivChief    = computed(() => role.value === 'Division Chief')
  const isSectionHead = computed(() => role.value === 'Section Head')
  const isStaff       = computed(() => role.value === 'Staff')

  const canViewAllDivisions = computed(() => isAdmin.value || isDirector.value)
  const canApprove = computed(() => isAdmin.value || isDirector.value || isAsstDir.value || isDivChief.value || isSectionHead.value)
  const canManageUsers = computed(() => isAdmin.value)
  const canViewAudit = computed(() => isAdmin.value || isDirector.value)
  const canGenerateReports = computed(() => isAdmin.value || isDirector.value || isAsstDir.value || isDivChief.value || isSectionHead.value)
  const divisionScope = computed(() => {
    if (isAdmin.value || isDirector.value) return null
    if (isAsstDir.value) return 'admin-pool'
    return authStore.profile?.divisionId ?? null
  })

  return {
    role, isAdmin, isDirector, isAsstDir, isDivChief, isSectionHead, isStaff,
    canViewAllDivisions, canApprove, canManageUsers, canViewAudit,
    canGenerateReports, divisionScope
  }
}