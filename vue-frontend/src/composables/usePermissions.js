// src/composables/usePermissions.js
// Centralised RBAC helper used by all components.

import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { ROLES } from '@/router'

export function usePermissions() {
  const authStore = useAuthStore()
  const role      = computed(() => authStore.role)

  const isAdmin    = computed(() => role.value === ROLES.ADMIN)
  const isDirector = computed(() => role.value === ROLES.DIRECTOR)
  const isAsstDir  = computed(() => role.value === ROLES.ASST_DIR)
  const isDivChief = computed(() => role.value === ROLES.DIV_CHIEF)
  const isStaff    = computed(() => role.value === ROLES.STAFF)

  /** Can view all divisions (bureau-wide) */
  const canViewAllDivisions = computed(() =>
    isAdmin.value || isDirector.value
  )

  /** Can approve / reject accomplishment submissions */
  const canApprove = computed(() =>
    isAdmin.value || isDirector.value || isAsstDir.value || isDivChief.value
  )

  /** Can manage users */
  const canManageUsers = computed(() => isAdmin.value)

  /** Can view audit trail */
  const canViewAudit = computed(() => isAdmin.value || isDirector.value)

  /** Can generate reports */
  const canGenerateReports = computed(() =>
    isAdmin.value || isDirector.value || isAsstDir.value || isDivChief.value
  )

  /** Division scope: returns divisionId restriction or null for bureau-wide */
  const divisionScope = computed(() => {
    if (isAdmin.value || isDirector.value) return null     // all
    if (isAsstDir.value) return 'admin-pool'               // Admin Pool only
    return authStore.profile?.divisionId ?? null           // own division
  })

  return {
    role, isAdmin, isDirector, isAsstDir, isDivChief, isStaff,
    canViewAllDivisions, canApprove, canManageUsers, canViewAudit,
    canGenerateReports, divisionScope
  }
}
