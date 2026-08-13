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
    // These four reads are independent — none needs another's result — so
    // running them in parallel cuts total wait roughly 4x instead of paying
    // each round trip in series, and shortens how long this page load keeps
    // Apps Script's limited concurrent-execution slots occupied. tryFetch
    // already catches its own failures and returns the fallback, so a slow
    // or failed call here can never reject Promise.all or block the others.
    const [summaryResult, divisionsResult, statusResult, activityResult] = await Promise.all([
      tryFetch(() => dashboardApi.summary(requestParams), null),
      canSeeDivisions ? tryFetch(() => dashboardApi.divisions(requestParams), []) : Promise.resolve([]),
      tryFetch(() => dashboardApi.statusBreakdown(requestParams), []),
      tryFetch(() => dashboardApi.monthlyActivity(requestParams), [])
    ])
    summary.value         = summaryResult
    divisions.value       = divisionsResult
    statusBreakdown.value = statusResult
    monthlyActivity.value = activityResult
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
