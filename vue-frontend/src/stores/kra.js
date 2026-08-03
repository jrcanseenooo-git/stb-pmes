// src/stores/kra.js
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { kraApi } from '@/services/api'
import { useToast } from 'vue-toastification'

export const useKraStore = defineStore('kra', () => {
  const toast      = useToast()
  const kras       = ref([])
  const indicators = ref([])
  const loading    = ref(false)
  const error      = ref(null)

  async function fetchKras(params = {}) {
    loading.value = true
    try {
      kras.value = await kraApi.list(params)
    } catch (e) {
      error.value = 'Could not load KRA records. Please try again.'
    } finally {
      loading.value = false
    }
  }

  async function fetchIndicators(kraId) {
    loading.value = true
    try {
      indicators.value = await kraApi.listSI(kraId)
    } catch (e) {
      error.value = 'Could not load KRA indicators. Please try again.'
    } finally {
      loading.value = false
    }
  }

  async function createKra(data) {
    const kra = await kraApi.create(data)
    kras.value.unshift(kra)
    toast.success('KRA created')
    return kra
  }

  async function updateKra(id, data) {
    const updated = await kraApi.update(id, data)
    const idx = kras.value.findIndex(k => k.id === id)
    if (idx !== -1) kras.value[idx] = updated
    toast.success('KRA updated')
    return updated
  }

  async function deleteKra(id) {
    await kraApi.delete(id)
    kras.value = kras.value.filter(k => k.id !== id)
    toast.success('KRA deleted')
  }

  return {
    kras, indicators, loading, error,
    fetchKras, fetchIndicators, createKra, updateKra, deleteKra
  }
})
