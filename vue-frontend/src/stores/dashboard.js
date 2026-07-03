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
    loading.value = true
    const tryFetch = async (fn, fallback) => {
      try { return await fn() } catch (e) {
        console.warn('[Dashboard]', e.message)
        return fallback
      }
    }
    summary.value         = await tryFetch(() => dashboardApi.summary(params),         null)
    divisions.value       = await tryFetch(() => dashboardApi.divisions(params),        [])
    statusBreakdown.value = await tryFetch(() => dashboardApi.statusBreakdown(params),  [])
    monthlyActivity.value = await tryFetch(() => dashboardApi.monthlyActivity(params),  [])
    loading.value = false
  }

  async function fetchActivity(params = {}) {
    try {
      monthlyActivity.value = await dashboardApi.monthlyActivity(params)
    } catch (e) {
      console.warn('[Dashboard]', e.message)
    }
  }

  return { summary, divisions, statusBreakdown, monthlyActivity, loading, fetchAll, fetchActivity }
})