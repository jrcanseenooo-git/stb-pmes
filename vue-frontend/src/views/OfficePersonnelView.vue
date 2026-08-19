<template>
  <div class="pui-page">
    <PageHeader
      v-if="!props.embedded"
      kicker="Office Administration"
      title="Personnel Validation"
      :subtitle="`Validate and maintain the ${officeName || 'office'} roster used for assessment assignments.`"
    >
      <template #actions>
        <button v-if="canManageOfficePersonnel" class="pui-btn pui-btn-primary" type="button" @click="openCreate">
          Add Personnel
        </button>
      </template>
    </PageHeader>

    <div class="pui-grid pui-grid-4">
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
        <div class="pui-tabs" role="tablist" aria-label="Filter by status">
          <button
            v-for="tab in STATUS_TABS"
            :key="tab.value"
            type="button"
            role="tab"
            :aria-selected="statusTab === tab.value"
            :class="['pui-tab', statusTab === tab.value && 'pui-tab-active']"
            @click="statusTab = tab.value"
          >
            {{ tab.label }}
          </button>
        </div>
      </template>

      <table class="pui-table">
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">Email</th>
            <th scope="col">Role</th>
            <th scope="col">Unit</th>
            <th scope="col">Section</th>
            <th scope="col">Status</th>
            <th scope="col" style="text-align:right;">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in pagedRows" :key="row.id">
            <td>
              <strong>{{ row.fullName }}</strong>
              <small>{{ row.employeeNo || 'No employee no.' }}</small>
            </td>
            <td style="white-space:nowrap;">{{ row.email }}</td>
            <td>{{ row.role || 'Technical Staff' }}</td>
            <td>{{ row.divisionName || row.organizationalUnitName || '-' }}</td>
            <td>{{ row.section || '-' }}</td>
            <td><StatusPill :status="row.status" /></td>
            <td>
              <div style="display:flex; justify-content:flex-end; gap:6px;">
                <button v-if="canManageOfficePersonnel" class="pui-btn pui-btn-sm" type="button" @click="openEdit(row)">
                  Edit
                </button>
                <button
                  v-if="canManageOfficePersonnel && row.status === 'Active'"
                  class="pui-btn pui-btn-sm pui-btn-danger"
                  type="button"
                  :disabled="busyId === row.id"
                  @click="deactivate(row)"
                >
                  Deactivate
                </button>
                <button
                  v-else-if="canManageOfficePersonnel"
                  class="pui-btn pui-btn-sm"
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

      <template #footer>
        <div class="personnel-pagination" aria-label="Personnel table pagination">
          <div class="personnel-pagination-range">
            Showing {{ pageStart }}-{{ pageEnd }} of {{ filteredRows.length }}
          </div>
          <div class="personnel-pagination-controls">
            <label class="personnel-page-size">
              <span>Rows</span>
              <select v-model.number="pageSize" class="pui-select">
                <option v-for="option in PAGE_SIZE_OPTIONS" :key="option" :value="option">{{ option }}</option>
              </select>
            </label>
            <button class="pui-btn pui-btn-sm" type="button" :disabled="page <= 1" @click="page -= 1">
              Previous
            </button>
            <span class="personnel-page-count">Page {{ page }} of {{ totalPages }}</span>
            <button class="pui-btn pui-btn-sm" type="button" :disabled="page >= totalPages" @click="page += 1">
              Next
            </button>
          </div>
        </div>
      </template>
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
      <form id="personnel-form" class="pui-grid pui-grid-2" @submit.prevent="save">
        <label class="pui-span-2">
          <span class="pui-label">Full Name</span>
          <input v-model="form.fullName" class="pui-input" type="text" required />
        </label>
        <label class="pui-span-2">
          <span class="pui-label">Email</span>
          <input v-model="form.email" class="pui-input" type="email" :disabled="!!editingId" required />
          <small v-if="editingId" class="pui-hint">
            Email identifies the record and cannot be changed here.
          </small>
        </label>
        <label>
          <span class="pui-label">Role</span>
          <select v-model="form.role" class="pui-select">
            <option v-for="option in roleOptions" :key="option" :value="option">{{ option }}</option>
          </select>
        </label>
        <label>
          <span class="pui-label">Employee No.</span>
          <input v-model="form.employeeNo" class="pui-input" type="text" />
        </label>
        <label>
          <span class="pui-label">Unit / Division</span>
          <select v-if="currentDivisions.length" v-model="form.divisionName" class="pui-select">
            <option value="">Select division…</option>
            <option v-for="division in currentDivisions" :key="division.id || division.name" :value="division.name">
              {{ division.name }}
            </option>
          </select>
          <input v-else v-model="form.divisionName" class="pui-input" type="text" />
        </label>
        <label>
          <span class="pui-label">Section</span>
          <select v-if="sectionsForDivision.length" v-model="form.section" class="pui-select">
            <option value="">Select section…</option>
            <option v-for="section in sectionsForDivision" :key="section.id || section.name" :value="section.name">
              {{ section.name }}
            </option>
          </select>
          <input v-else v-model="form.section" class="pui-input" type="text" />
        </label>
        <label class="pui-span-2">
          <span class="pui-label">Position / Title</span>
          <input v-model="form.position" class="pui-input" type="text" />
        </label>
      </form>

      <div v-if="modalError" class="pui-alert pui-alert-error" role="alert">
        <p>{{ modalError }}</p>
      </div>

      <template #footer>
        <button class="pui-btn" type="button" :disabled="saving" @click="closeModal">Cancel</button>
        <button class="pui-btn pui-btn-primary" type="submit" form="personnel-form" :disabled="saving">
          {{ saving ? 'Saving...' : 'Save Personnel' }}
        </button>
      </template>
    </AppModal>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { officePersonnelApi } from '@/services/api'
import { usePermissions } from '@/composables/usePermissions'
import { useBranding } from '@/composables/useBranding'
import { useConfirm } from '@/composables/useConfirm'
import { useOrgOptions } from '@/composables/useOrgOptions'
import PageHeader from '@/components/ui/PageHeader.vue'
import DataPanel from '@/components/ui/DataPanel.vue'
import StatTile from '@/components/ui/StatTile.vue'
import StatusPill from '@/components/ui/StatusPill.vue'
import AppModal from '@/components/ui/AppModal.vue'

const props = defineProps({
  embedded: { type: Boolean, default: false }
})

const { canManageOfficePersonnel } = usePermissions()
const { officeName } = useBranding()
const { confirm } = useConfirm()
const { loadOrgOptions, currentOrgOptions, currentDivisions, currentSections } = useOrgOptions()

const STATUS_TABS = [
  { value: 'all', label: 'All' },
  { value: 'Pending', label: 'For Validation' },
  { value: 'Active', label: 'Active' },
  { value: 'Inactive', label: 'Inactive' }
]
const PAGE_SIZE_OPTIONS = [10, 25, 50]

const FALLBACK_ROLE_OPTIONS = [
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
const page = ref(1)
const pageSize = ref(10)
const showModal = ref(false)
const editingId = ref('')
const lastUpdatedAt = ref(null)
const form = ref(defaultForm())

// Office rosters carry the office's own titles. Use the same requested-role
// options configured in Office Registry, while preserving the currently edited
// role if an older roster row no longer appears in the registry list.
const roleOptions = computed(() => {
  const options = normalizeRoleOptions(currentOrgOptions.value?.requestedRoles)
  const current = normalizeRole(form.value?.role)
  return current && !options.includes(current) ? [...options, current] : options
})

onMounted(async () => {
  await Promise.all([loadRows(), loadOrgOptions()])
})

function defaultForm() {
  return {
    fullName: '',
    email: '',
    role: normalizeRoleOptions(currentOrgOptions.value?.requestedRoles)[0],
    employeeNo: '',
    divisionName: '',
    section: '',
    position: ''
  }
}

function normalizeRole(value) {
  const role = String(value || '').trim()
  return role === 'Staff' ? 'Technical Staff' : role
}

function normalizeRoleOptions(roles = []) {
  const source = Array.isArray(roles) && roles.length ? roles : FALLBACK_ROLE_OPTIONS
  const seen = new Set()
  return source.map(normalizeRole).filter(role => {
    const key = role.toLowerCase()
    if (!role || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

const counts = computed(() => ({
  total: rows.value.length,
  active: rows.value.filter(r => r.status === 'Active').length,
  pending: rows.value.filter(r => r.status === 'Pending').length,
  inactive: rows.value.filter(r => r.status === 'Inactive').length
}))

const selectedDivision = computed(() =>
  currentDivisions.value.find(division => division.name === form.value.divisionName || division.id === form.value.divisionName)
)
const sectionsForDivision = computed(() => {
  const divisionId = selectedDivision.value?.id || ''
  return currentSections.value.filter(section => String(section.divisionId || '') === String(divisionId))
})

watch(() => form.value.divisionName, () => {
  if (!form.value.section) return
  const valid = sectionsForDivision.value.some(section => section.name === form.value.section)
  if (!valid) form.value.section = ''
})

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

const totalPages = computed(() => Math.max(1, Math.ceil(filteredRows.value.length / pageSize.value)))
const pageStart = computed(() => filteredRows.value.length ? (page.value - 1) * pageSize.value + 1 : 0)
const pageEnd = computed(() => Math.min(filteredRows.value.length, page.value * pageSize.value))
const pagedRows = computed(() => filteredRows.value.slice(pageStart.value ? pageStart.value - 1 : 0, pageEnd.value))

watch([search, statusTab, pageSize], () => {
  page.value = 1
})

watch(totalPages, value => {
  if (page.value > value) page.value = value
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
  const ok = await confirm({
    title: editingId.value ? 'Save Changes' : 'Add Personnel',
    message: editingId.value
      ? `Save changes to ${form.value.fullName || 'this personnel record'}?`
      : `Add ${form.value.fullName || 'this person'} to the assessment roster?`,
    confirmLabel: 'Save'
  })
  if (!ok) return

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

<style scoped>
.personnel-pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  font-size: 12px;
  color: #475569;
}

.personnel-pagination-range,
.personnel-page-count {
  font-weight: 700;
}

.personnel-pagination-controls {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  flex-wrap: wrap;
}

.personnel-page-size {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-weight: 700;
}

.personnel-page-size .pui-select {
  width: 76px;
  height: 32px;
}
</style>
