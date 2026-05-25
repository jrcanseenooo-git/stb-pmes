// src/stores/accomplishments.js
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { accomplishmentsApi } from '@/services/api'
import { useToast } from 'vue-toastification'

export const STATUSES = {
  NOT_STARTED:  'Not Started',
  ONGOING:      'Ongoing',
  SUBMITTED:    'Submitted',
  FOR_REVISION: 'For Revision',
  APPROVED:     'Approved',
  DELAYED:      'Delayed',
  COMPLETED:    'Completed'
}

export const useAccomplishmentsStore = defineStore('accomplishments', () => {
  const toast           = useToast()
  const accomplishments = ref([])
  const selected        = ref(null)
  const history         = ref([])
  const loading         = ref(false)
  const pagination      = ref({ page: 1, pageSize: 20, total: 0 })
  const filters         = ref({ status: '', divisionId: '', kraId: '', search: '' })

  const delayed = computed(() =>
    accomplishments.value.filter(a => a.status === STATUSES.DELAYED)
  )
  const forRevision = computed(() =>
    accomplishments.value.filter(a => a.status === STATUSES.FOR_REVISION)
  )

  async function fetchAll(params = {}) {
    loading.value = true
    try {
      const result = await accomplishmentsApi.list({
        ...filters.value,
        page:     pagination.value.page,
        pageSize: pagination.value.pageSize,
        ...params
      })
      accomplishments.value    = result.items ?? result
      pagination.value.total   = result.total ?? accomplishments.value.length
    } catch (e) {
      console.error(e)
    } finally {
      loading.value = false
    }
  }

  async function fetchOne(id) {
    selected.value = await accomplishmentsApi.get(id)
    return selected.value
  }

  async function create(data) {
    const item = await accomplishmentsApi.create(data)
    accomplishments.value.unshift(item)
    toast.success('Accomplishment entry created')
    return item
  }

  async function update(id, data) {
    const updated = await accomplishmentsApi.update(id, data)
    replaceInList(id, updated)
    toast.success('Entry updated')
    return updated
  }

  async function approve(id, remarks = '') {
    const updated = await accomplishmentsApi.approve(id, remarks)
    replaceInList(id, updated)
    toast.success('Accomplishment approved')
  }

  async function requestRevision(id, remarks) {
    const updated = await accomplishmentsApi.requestRevision(id, remarks)
    replaceInList(id, updated)
    toast.info('Revision requested')
  }

  async function fetchHistory(id) {
    history.value = await accomplishmentsApi.history(id)
  }

  function replaceInList(id, updated) {
    const idx = accomplishments.value.findIndex(a => a.id === id)
    if (idx !== -1) accomplishments.value[idx] = updated
    if (selected.value?.id === id) selected.value = updated
  }

  function setFilter(key, value) {
    filters.value[key] = value
    pagination.value.page = 1
  }

  return {
    accomplishments, selected, history, loading, pagination, filters,
    delayed, forRevision,
    fetchAll, fetchOne, create, update, approve, requestRevision,
    fetchHistory, setFilter
  }
})
