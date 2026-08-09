<template>
  <div class="pmes-page p-4 grid gap-4 content-start">
    <PageHeader
      kicker="Office Administration"
      title="Personnel Validation"
      :subtitle="`Validate and maintain the ${officeName || 'office'} roster used for assessment assignments.`"
    >
      <template #actions>
        <button v-if="canManageOfficePersonnel" class="btn-primary" type="button" @click="openCreate">
          Add Personnel
        </button>
      </template>
    </PageHeader>

    <div class="grid gap-3 grid-cols-2 lg:grid-cols-4">
      <StatTile label="Total Personnel" :value="counts.total" :loading="loading" />
      <StatTile label="Active" :value="counts.active" :loading="loading" tone="good" />
      <StatTile label="For Validation" :value="counts.pending" :loading="loading" :tone="counts.pending ? 'warn' : 'default'" />
      <StatTile label="Inactive" :value="counts.inactive" :loading="loading" />
    </div>

    <DataPanel
      title="Assessment Roster"
      :subtitle="`${filteredRows.length} of ${rows.length} personnel shown`"
      :loading="loading"
      :error="error"
      error-title="The roster could not be loaded"
      :empty="!filteredRows.length"
      :empty-title="rows.length ? 'No personnel match this view' : 'No personnel records yet'"
      :empty-description="rows.length
        ? 'Try a different status tab or clear the search.'
        : 'Personnel appear here once they are approved for this office, or you can add them manually.'"
      searchable
      :search="search"
      search-placeholder="Search name, email, unit..."
      :last-updated="lastUpdatedLabel"
      refreshable
      @update:search="onSearch"
      @refresh="loadRows"
    >
      <template #filters>
        <div class="flex items-center gap-1 rounded-xl bg-slate-100 p-1" role="tablist" aria-label="Filter by status">
          <button
            v-for="tab in STATUS_TABS"
            :key="tab.value"
            type="button"
            role="tab"
            :aria-selected="statusTab === tab.value"
            :class="[
              'px-3 py-1 rounded-lg text-xs font-extrabold transition-colors',
              statusTab === tab.value ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            ]"
            @click="statusTab = tab.value"
          >
            {{ tab.label }}
          </button>
        </div>
      </template>

      <table class="data-table">
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">Email</th>
            <th scope="col">Role</th>
            <th scope="col">Unit</th>
            <th scope="col">Section</th>
            <th scope="col">Status</th>
            <th scope="col" class="text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in filteredRows" :key="row.id">
            <td>
              <strong class="block text-[13px] text-slate-900">{{ row.fullName }}</strong>
              <span class="block text-slate-500 mt-0.5">{{ row.employeeNo || 'No employee no.' }}</span>
            </td>
            <td class="whitespace-nowrap">{{ row.email }}</td>
            <td>{{ row.role || 'Technical Staff' }}</td>
            <td>{{ row.divisionName || row.organizationalUnitName || '—' }}</td>
            <td>{{ row.section || '—' }}</td>
            <td><StatusPill :status="row.status" /></td>
            <td>
              <div class="flex items-center justify-end gap-1.5">
                <button v-if="canManageOfficePersonnel" class="btn-secondary !py-1 !px-2.5 !text-xs" type="button" @click="openEdit(row)">
                  Edit
                </button>
                <button
                  v-if="canManageOfficePersonnel && row.status === 'Active'"
                  class="btn-danger !py-1 !px-2.5 !text-xs"
                  type="button"
                  :disabled="busyId === row.id"
                  @click="deactivate(row)"
                >
                  Deactivate
                </button>
                <button
                  v-else-if="canManageOfficePersonnel"
                  class="btn-secondary !py-1 !px-2.5 !text-xs"
                  type="button"
                  :disabled="busyId === row.id"
                  @click="activate(row)"
                >
                  Activate
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </DataPanel>

    <AppModal
      :show="showModal"
      :title="editingId ? 'Edit Personnel' : 'Add Personnel'"
      :description="editingId
        ? 'Update roster details used for assessment assignment.'
        : 'Add a personnel record to this office roster.'"
      :busy="saving"
      @close="closeModal"
    >
      <form id="personnel-form" class="grid grid-cols-1 sm:grid-cols-2 gap-3" @submit.prevent="save">
        <label class="sm:col-span-2">
          <span class="form-label">Full Name</span>
          <input v-model="form.fullName" class="form-input" type="text" required />
        </label>
        <label class="sm:col-span-2">
          <span class="form-label">Email</span>
          <input v-model="form.email" class="form-input" type="email" :disabled="!!editingId" required />
          <small v-if="editingId" class="block mt-1 text-[11px] text-slate-500">
            Email identifies the record and cannot be changed here.
          </small>
        </label>
        <label>
          <span class="form-label">Role</span>
          <select v-model="form.role" class="form-select">
            <option v-for="option in roleOptions" :key="option" :value="option">{{ option }}</option>
          </select>
        </label>
        <label>
          <span class="form-label">Employee No.</span>
          <input v-model="form.employeeNo" class="form-input" type="text" />
        </label>
        <label>
          <span class="form-label">Unit / Division</span>
          <input v-model="form.divisionName" class="form-input" type="text" />
        </label>
        <label>
          <span class="form-label">Section</span>
          <input v-model="form.section" class="form-input" type="text" />
        </label>
        <label class="sm:col-span-2">
          <span class="form-label">Position / Title</span>
          <input v-model="form.position" class="form-input" type="text" />
        </label>
      </form>

      <div v-if="modalError" class="rounded-xl border border-red-100 bg-red-50 px-3 py-2" role="alert">
        <p class="text-xs text-red-700">{{ modalError }}</p>
      </div>

      <template #footer>
        <button class="btn-secondary" type="button" :disabled="saving" @click="closeModal">Cancel</button>
        <button class="btn-primary" type="submit" form="personnel-form" :disabled="saving">
          {{ saving ? 'Saving...' : 'Save Personnel' }}
        </button>
      </template>
    </AppModal>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { officePersonnelApi } from '@/services/api'
import { usePermissions } from '@/composables/usePermissions'
import { useBranding } from '@/composables/useBranding'
import { useConfirm } from '@/composables/useConfirm'
import PageHeader from '@/components/ui/PageHeader.vue'
import DataPanel from '@/components/ui/DataPanel.vue'
import StatTile from '@/components/ui/StatTile.vue'
import StatusPill from '@/components/ui/StatusPill.vue'
import AppModal from '@/components/ui/AppModal.vue'

const { canManageOfficePersonnel } = usePermissions()
const { officeName } = useBranding()
const { confirm } = useConfirm()

const STATUS_TABS = [
  { value: 'all', label: 'All' },
  { value: 'Pending', label: 'For Validation' },
  { value: 'Active', label: 'Active' },
  { value: 'Inactive', label: 'Inactive' }
]

// Office rosters carry the office's own titles. These are the request options
// the registry seeds; an office administrator still validates the final role.
const roleOptions = [
  'Technical Staff',
  'Section Head',
  'Division Chief',
  'Assistant Bureau Director',
  'Bureau Director'
]

const rows = ref([])
const loading = ref(false)
const saving = ref(false)
const busyId = ref('')
const error = ref('')
const modalError = ref('')
const search = ref('')
const statusTab = ref('all')
const showModal = ref(false)
const editingId = ref('')
const lastUpdatedAt = ref(null)
const form = ref(defaultForm())

onMounted(loadRows)

function defaultForm() {
  return {
    fullName: '',
    email: '',
    role: 'Technical Staff',
    employeeNo: '',
    divisionName: '',
    section: '',
    position: ''
  }
}

const counts = computed(() => ({
  total: rows.value.length,
  active: rows.value.filter(r => r.status === 'Active').length,
  pending: rows.value.filter(r => r.status === 'Pending').length,
  inactive: rows.value.filter(r => r.status === 'Inactive').length
}))

// Filtering runs client-side over an already office-scoped roster, so switching
// tabs or refining a search costs no extra backend round trip.
const filteredRows = computed(() => {
  const term = search.value.trim().toLowerCase()
  return rows.value.filter(row => {
    if (statusTab.value !== 'all' && row.status !== statusTab.value) return false
    if (!term) return true
    return [row.fullName, row.email, row.role, row.divisionName, row.organizationalUnitName, row.section, row.position]
      .some(field => String(field || '').toLowerCase().includes(term))
  })
})

const lastUpdatedLabel = computed(() =>
  lastUpdatedAt.value ? lastUpdatedAt.value.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''
)

function onSearch(value) {
  search.value = value
}

async function loadRows() {
  loading.value = true
  error.value = ''
  try {
    const data = await officePersonnelApi.list({ pageSize: 500 })
    rows.value = data.items || []
    lastUpdatedAt.value = new Date()
  } catch (e) {
    error.value = e?.message || 'Please check your connection and try again.'
  } finally {
    loading.value = false
  }
}

function openCreate() {
  editingId.value = ''
  form.value = defaultForm()
  modalError.value = ''
  showModal.value = true
}

function openEdit(row) {
  editingId.value = row.id
  form.value = {
    fullName: row.fullName || '',
    email: row.email || '',
    role: row.role || 'Technical Staff',
    employeeNo: row.employeeNo || '',
    divisionName: row.divisionName || row.organizationalUnitName || '',
    section: row.section || '',
    position: row.position || ''
  }
  modalError.value = ''
  showModal.value = true
}

function closeModal() {
  if (saving.value) return
  showModal.value = false
}

async function save() {
  saving.value = true
  modalError.value = ''
  try {
    if (editingId.value) await officePersonnelApi.update(editingId.value, form.value)
    else await officePersonnelApi.create(form.value)
    await loadRows()
    showModal.value = false
  } catch (e) {
    modalError.value = e?.message || 'Could not save this personnel record.'
  } finally {
    saving.value = false
  }
}

async function deactivate(row) {
  const ok = await confirm({
    type: 'danger',
    title: 'Deactivate Personnel',
    message: `${row.fullName} will be removed from new assessment assignments for this office. Existing submitted ratings are preserved.`,
    confirmLabel: 'Deactivate'
  })
  if (!ok) return
  await runRowAction(row, () => officePersonnelApi.deactivate(row.id), 'Could not deactivate this personnel record.')
}

async function activate(row) {
  const ok = await confirm({
    title: 'Activate Personnel',
    message: `${row.fullName} will be marked active and can be included in assessment assignments for this office.`,
    confirmLabel: 'Activate'
  })
  if (!ok) return
  await runRowAction(row, () => officePersonnelApi.activate(row.id), 'Could not activate this personnel record.')
}

async function runRowAction(row, action, fallbackMessage) {
  busyId.value = row.id
  error.value = ''
  try {
    await action()
    await loadRows()
  } catch (e) {
    error.value = e?.message || fallbackMessage
  } finally {
    busyId.value = ''
  }
}
</script>
