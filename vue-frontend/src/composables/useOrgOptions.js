import { computed, ref } from 'vue'
import { authApi } from '@/services/api'
import { useAuthStore } from '@/stores/auth'

const STB_OFFICE_ID = 'STB'

const STB_DIVISIONS = [
  { id: 'admin-pool', name: 'Admin Pool' },
  { id: 'dfd', name: 'Design Formulation Division' },
  { id: 'pid', name: 'Pilot Implementation Division' },
  { id: 'staed', name: 'Social Technology Analysis and Evaluation Division' }
]

const STB_SECTIONS = [
  { id: 'SEC-admin-office', divisionId: 'admin-pool', name: 'Office Admin Personnel' },
  { id: 'SEC-dfd-cy', divisionId: 'dfd', name: 'Children and Youth Section' },
  { id: 'SEC-dfd-omg', divisionId: 'dfd', name: 'Other Marginalized Groups Section' },
  { id: 'SEC-dfd-wpo', divisionId: 'dfd', name: 'Women, Persons with Disability and Older Persons Section' },
  { id: 'SEC-pid-cy', divisionId: 'pid', name: 'Children and Youth Section' },
  { id: 'SEC-pid-omg', divisionId: 'pid', name: 'Other Marginalized Groups Section' },
  { id: 'SEC-pid-wpo', divisionId: 'pid', name: 'Women, Persons with Disability and Older Persons Section' },
  { id: 'SEC-staed-ev', divisionId: 'staed', name: 'Social Technology Evaluation Section' },
  { id: 'SEC-staed-pm', divisionId: 'staed', name: 'Social Technology Portfolio Management Section' },
  { id: 'SEC-staed-pr', divisionId: 'staed', name: 'Social Technology Promotion Section' }
]

function officeKey(value) {
  return String(value || '').trim().toUpperCase()
}

function isStbOffice(value) {
  const key = officeKey(value)
  return !key || key === STB_OFFICE_ID || key === 'SOCIAL TECHNOLOGY BUREAU'
}

function uniqueOptions(items = [], getKey = item => item.id || item.name) {
  const seen = new Set()
  return items.filter(item => {
    const key = String(getKey(item) || '').trim().toLowerCase()
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// Module-scope, not inside useOrgOptions() - this is session-static registry
// data (divisions/sections/roles by office), the same payload for every
// caller. It was previously declared inside the composable, so each of
// EvaluationView/OfficePersonnelView/UsersView got its own instance-scoped
// ref and re-fetched auth/register-options independently on mount, even
// within the same session. One shared cache means the second and third
// callers read it for free.
const loadingOrgOptions = ref(false)
const orgOptionsError = ref('')
const rawOptions = ref(null)

export function useOrgOptions() {
  const authStore = useAuthStore()

  async function loadOrgOptions() {
    if (rawOptions.value || loadingOrgOptions.value) return rawOptions.value
    loadingOrgOptions.value = true
    orgOptionsError.value = ''
    try {
      rawOptions.value = await authApi.registerOptions()
    } catch (e) {
      orgOptionsError.value = e?.message || 'Could not load office options.'
      rawOptions.value = {}
    } finally {
      loadingOrgOptions.value = false
    }
    return rawOptions.value
  }

  function optionsForOffice(officeId, officeCode = '') {
    const opts = rawOptions.value || {}
    if (isStbOffice(officeId || officeCode)) {
      // STB configures its own roles in the Office Registry like every other
      // office does. This used to read only the top-level `requestedRoles`,
      // which is a fixed Bureau ladder, so a role added to STB's tagging -
      // 'Admin Staff' - never reached the Role select and could not be
      // assigned. Prefer STB's registry entry and keep the fixed ladder as the
      // fallback for a database that has no tagging saved yet.
      const stbConfigured = (opts.officeOptions || {})[STB_OFFICE_ID] || {}
      const configuredRoles = stbConfigured.requestedRoles || []
      return {
        divisions: uniqueOptions([...(opts.divisions || []), ...STB_DIVISIONS]),
        sections: uniqueOptions([...(opts.sections || []), ...STB_SECTIONS], item => `${item.divisionId || ''}:${item.name || ''}`),
        requestedRoles: configuredRoles.length ? configuredRoles : (opts.requestedRoles || [])
      }
    }

    const byOffice = opts.officeOptions || {}
    const direct = byOffice[officeId] || byOffice[officeCode]
    if (direct) return direct

    const key = officeKey(officeId || officeCode)
    const office = (opts.offices || []).find(item =>
      officeKey(item.officeId) === key ||
      officeKey(item.officeCode) === key ||
      officeKey(item.officeName) === key
    )
    return (office && byOffice[office.officeId]) || { divisions: [], sections: [], requestedRoles: [] }
  }

  const currentOfficeId = computed(() => authStore.profile?.officeId || STB_OFFICE_ID)
  const currentOfficeCode = computed(() => authStore.profile?.officeCode || currentOfficeId.value)
  const currentOrgOptions = computed(() => optionsForOffice(currentOfficeId.value, currentOfficeCode.value))
  const currentDivisions = computed(() => currentOrgOptions.value.divisions || [])
  const currentSections = computed(() => currentOrgOptions.value.sections || [])

  return {
    loadingOrgOptions,
    orgOptionsError,
    rawOptions,
    loadOrgOptions,
    optionsForOffice,
    currentOfficeId,
    currentOfficeCode,
    currentOrgOptions,
    currentDivisions,
    currentSections,
    isStbOffice
  }
}
