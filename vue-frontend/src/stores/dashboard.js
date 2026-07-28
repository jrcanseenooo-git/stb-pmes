import { defineStore } from 'pinia'
import { ref } from 'vue'
import { dashboardApi } from '@/services/api'
import { useAuthStore } from '@/stores/auth'

export const useDashboardStore = defineStore('dashboard', () => {
  const summary         = ref(null)
  const divisions       = ref([])
  const statusBreakdown = ref([])
  const monthlyActivity = ref([])
  const loading         = ref(false)

  async function fetchAll(params = {}) {
    const silent = params.silent === true
    const requestParams = { ...params }
    delete requestParams.silent
    if (!silent) loading.value = true
    const auth = useAuthStore()
    const permissions = auth.profile?.permissions || []
    const canSeeDivisions =
      permissions.includes('view_bureau_monitoring') ||
      permissions.includes('view_division_monitoring') ||
      ['System Administrator', 'Bureau Director', 'Assistant Bureau Director', 'Division Chief'].includes(auth.role)
    const tryFetch = async (fn, fallback) => {
      try { return await fn() } catch (e) {
        if (import.meta.env.DEV) console.warn('[Dashboard]', e.message)
        return fallback
      }
    }
    summary.value         = await tryFetch(() => dashboardApi.summary(requestParams),         null)
    divisions.value       = canSeeDivisions
      ? await tryFetch(() => dashboardApi.divisions(requestParams), [])
      : []
    statusBreakdown.value = await tryFetch(() => dashboardApi.statusBreakdown(requestParams),  [])
    monthlyActivity.value = await tryFetch(() => dashboardApi.monthlyActivity(requestParams),  [])
    if (!silent) loading.value = false
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
