import { defineStore } from 'pinia'
import { ref } from 'vue'
import { dashboardApi } from '@/services/api'
import { useAuthStore } from '@/stores/auth'

// The Division Performance card is only meaningful to roles the backend lets
// see cross-division data; Staff/Section Heads get a 403. Skip the call for them
// so it doesn't spam the console with an "Access denied" warning on every load.
const DIVISION_ROLES = ['System Administrator', 'Bureau Director', 'Assistant Bureau Director', 'Division Chief']

export const useDashboardStore = defineStore('dashboard', () => {
  const summary         = ref(null)
  const divisions       = ref([])
  const statusBreakdown = ref([])
  const monthlyActivity = ref([])
  const loading         = ref(false)

  async function fetchAll(params = {}) {
    loading.value = true
    const canSeeDivisions = DIVISION_ROLES.includes(useAuthStore().role)
    const tryFetch = async (fn, fallback) => {
      try { return await fn() } catch (e) {
        if (import.meta.env.DEV) console.warn('[Dashboard]', e.message)
        return fallback
      }
    }
    summary.value         = await tryFetch(() => dashboardApi.summary(params),         null)
    divisions.value       = canSeeDivisions
      ? await tryFetch(() => dashboardApi.divisions(params), [])
      : []
    statusBreakdown.value = await tryFetch(() => dashboardApi.statusBreakdown(params),  [])
    monthlyActivity.value = await tryFetch(() => dashboardApi.monthlyActivity(params),  [])
    loading.value = false
  }

  async function fetchActivity(params = {}) {
    try {
      monthlyActivity.value = await dashboardApi.monthlyActivity(params)
    } catch (e) {
      if (import.meta.env.DEV) console.warn('[Dashboard]', e.message)
    }
  }

  return { summary, divisions, statusBreakdown, monthlyActivity, loading, fetchAll, fetchActivity }
})