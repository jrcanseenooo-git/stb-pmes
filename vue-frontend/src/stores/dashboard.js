import { defineStore } from 'pinia'
import { ref } from 'vue'
import { dashboardApi } from '@/services/api'

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
    // Parallelizing these as four separate requests (summary/divisions/
    // status/activity) still meant four separate Apps Script executions,
    // each independently re-reading the same Accomplishments/Users sheets
    // from scratch and competing for Apps Script's limited concurrency -
    // exactly the kind of load that was tipping requests into a Vercel
    // Hobby-plan 504. dashboard/all reads each sheet once on the backend
    // and returns everything from a single execution.
    try {
      const result = await dashboardApi.all(requestParams)
      summary.value         = result?.summary ?? null
      divisions.value       = result?.divisions ?? []
      statusBreakdown.value = result?.statusBreakdown ?? []
      monthlyActivity.value = result?.monthlyActivity ?? []
    } catch (e) {
      if (import.meta.env.DEV) console.warn('[Dashboard]', e.message)
    }
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
