<template>
  <div class="pmes-page p-4 grid gap-4 content-start">
    <PageHeader
      kicker="Central Administration"
      title="Office Registry"
      subtitle="Provision, validate and activate evaluation-only spreadsheets for participating offices."
    >
      <template #actions>
        <RouterLink v-if="canViewClusterMonitoring" to="/cluster-overview" class="btn-secondary">Cluster Overview</RouterLink>
        <button v-if="canManageOfficeRegistry" class="btn-primary" type="button" @click="openProvisionModal">Add Office</button>
      </template>
    </PageHeader>

    <DataPanel
      title="Participating Offices"
      :subtitle="`${filteredOffices.length} of ${offices.length} offices shown`"
      :loading="loading"
      :error="error"
      error-title="The office registry could not be loaded"
      :empty="!filteredOffices.length"
      :empty-title="offices.length ? 'No offices match your search' : 'No offices registered yet'"
      :empty-description="offices.length
        ? 'Try a different search term.'
        : 'Add an office to create its evaluation-only spreadsheet and register it centrally.'"
      searchable
      :search="search"
      search-placeholder="Search office or admin..."
      :last-updated="lastUpdatedLabel"
      refreshable
      @update:search="value => (search = value)"
      @refresh="loadOffices"
    >
      <template v-if="canManageOfficeRegistry" #emptyAction>
        <button class="btn-primary" type="button" @click="openProvisionModal">Add Office</button>
      </template>

      <table class="data-table">
        <thead>
          <tr>
            <th scope="col">Office</th>
            <th scope="col">Primary Admin</th>
            <th scope="col">Office Status</th>
            <th scope="col">Portal Status</th>
            <th scope="col">Last Validated</th>
            <th scope="col" class="text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="office in filteredOffices" :key="office.officeId">
            <td>
              <strong class="block text-[13px] text-slate-900">{{ office.officeCode }}</strong>
              <span class="block text-slate-500 mt-0.5">{{ office.officeName }}</span>
            </td>
            <td class="whitespace-nowrap">{{ office.primaryAdminEmail || '—' }}</td>
            <td><StatusPill :status="office.officeStatus || 'DRAFT'" /></td>
            <td>
              <StatusPill :status="office.spreadsheetStatus || 'NOT_PROVISIONED'" />
              <!-- A registry row left mid-provisioning is recoverable, not broken.
                   Provisioning has timed out in production before, so the resume
                   path is stated rather than left for the operator to infer. -->
              <small v-if="needsResume(office)" class="block text-amber-700 font-bold text-[10.5px] mt-1 leading-snug">
                Setup incomplete — run Validate, then Activate.
              </small>
            </td>
            <td class="whitespace-nowrap">{{ formatDate(office.lastValidatedAt) }}</td>
            <td>
              <div class="flex items-center justify-end gap-1.5">
                <template v-if="canManageOfficeRegistry && !isStbOffice(office)">
                  <button
                    class="btn-secondary !py-1 !px-2.5 !text-xs"
                    type="button"
                    :disabled="busyId === office.officeId"
                    title="Check the office spreadsheet against the required schema"
                    @click="validateOffice(office)"
                  >
                    {{ busyId === office.officeId && busyAction === 'validate' ? 'Validating...' : 'Validate' }}
                  </button>
                  <button
                    class="btn-secondary !py-1 !px-2.5 !text-xs"
                    type="button"
                    :disabled="busyId === office.officeId || !canActivate(office)"
                    :title="activateHint(office)"
                    @click="activateOffice(office)"
                  >
                    {{ busyId === office.officeId && busyAction === 'activate' ? 'Activating...' : 'Activate' }}
                  </button>
                  <button
                    class="btn-secondary !py-1 !px-2.5 !text-xs"
                    type="button"
                    :disabled="busyId === office.officeId"
                    title="Configure the divisions, sections and roles offered at registration"
                    @click="openOrgOptionsModal(office)"
                  >
                    Configure
                  </button>
                </template>
                <span v-else-if="canManageOfficeRegistry" class="text-[11px] font-bold text-slate-500">Central PMES</span>
                <span v-else class="text-[11px] font-bold text-slate-500">Monitoring only</span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </DataPanel>

    <!-- Provisioning -->
    <AppModal
      :show="showProvisionModal"
      title="Provision Office"
      description="Creates an evaluation-only spreadsheet through the protected backend process and registers it centrally."
      :busy="saving"
      @close="closeProvisionModal"
    >
      <form id="provision-form" class="grid grid-cols-1 sm:grid-cols-2 gap-3" @submit.prevent="provisionOffice">
        <label>
          <span class="form-label">Office Code</span>
          <input v-model="form.officeCode" class="form-input" type="text" placeholder="EPAHP" required :disabled="saving" />
        </label>
        <label>
          <span class="form-label">Office Short Name</span>
          <input v-model="form.officeShortName" class="form-input" type="text" placeholder="EPAHP" :disabled="saving" />
        </label>
        <label class="sm:col-span-2">
          <span class="form-label">Office Name</span>
          <input
            v-model="form.officeName"
            class="form-input"
            type="text"
            placeholder="Enhanced Partnership Against Hunger and Poverty"
            required
            :disabled="saving"
          />
        </label>
        <label class="sm:col-span-2">
          <span class="form-label">Primary Office Admin Email</span>
          <input v-model="form.primaryAdminEmail" class="form-input" type="email" placeholder="admin@dswd.gov.ph" required :disabled="saving" />
        </label>
      </form>

      <!-- Provisioning is a multi-step backend operation that can exceed the
           Apps Script execution window. Showing the steps means an operator who
           hits a timeout knows which stage was reached. -->
      <ol class="rounded-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
        <li v-for="(step, index) in PROVISION_STEPS" :key="step" class="px-4 py-2.5 flex items-center gap-3">
          <span
            :class="[
              'w-5 h-5 rounded-full grid place-items-center text-[10px] font-extrabold shrink-0',
              stepState(index) === 'done' ? 'bg-emerald-100 text-emerald-700'
                : stepState(index) === 'active' ? 'bg-blue-700 text-white'
                : 'bg-slate-100 text-slate-400'
            ]"
          >
            {{ stepState(index) === 'done' ? '✓' : index + 1 }}
          </span>
          <span :class="['text-xs', stepState(index) === 'idle' ? 'text-slate-400' : 'font-bold text-slate-700']">
            {{ step }}
          </span>
        </li>
      </ol>

      <div v-if="modalError" class="rounded-xl border border-red-100 bg-red-50 px-3 py-2.5" role="alert">
        <p class="text-xs font-bold text-red-800">Provisioning did not complete</p>
        <p class="mt-0.5 text-xs text-red-700 leading-relaxed">{{ modalError }}</p>
        <p class="mt-1.5 text-xs text-red-700 leading-relaxed">
          If a partial office row now appears in the registry, do not add the office again —
          use Validate and then Activate on the existing row.
        </p>
      </div>

      <div v-if="lastValidation" class="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2.5">
        <p class="text-xs font-bold text-blue-900">
          {{ lastValidation.valid ? 'Schema validation passed' : 'Schema validation needs attention' }}
        </p>
        <ul v-if="lastValidation.errors?.length" class="mt-1.5 pl-4 list-disc text-xs text-blue-900 leading-relaxed">
          <li v-for="item in lastValidation.errors" :key="item">{{ item }}</li>
        </ul>
      </div>

      <template #footer>
        <button class="btn-secondary" type="button" :disabled="saving" @click="closeProvisionModal">Cancel</button>
        <button class="btn-primary" type="submit" form="provision-form" :disabled="saving">
          {{ saving ? 'Provisioning...' : 'Create Evaluation Spreadsheet' }}
        </button>
      </template>
    </AppModal>

    <!-- Registration options -->
    <AppModal
      :show="showOrgModal"
      title="Configure Registration Options"
      :description="`${orgOffice?.officeName || 'Office'} divisions, sections and requested roles.`"
      width="880px"
      :busy="orgSaving"
      @close="closeOrgOptionsModal"
    >
      <form id="org-form" class="grid grid-cols-1 lg:grid-cols-2 gap-3" @submit.prevent="saveOrgOptions">
        <label>
          <span class="form-label">Divisions / Units</span>
          <textarea
            v-model="orgForm.divisionsText"
            class="form-input font-mono !text-xs"
            rows="8"
            placeholder="One per line&#10;Operations Division&#10;ADMIN | Administrative Unit"
          ></textarea>
          <small class="block mt-1 text-[11px] text-slate-500">One line per unit. Optional format: <code>CODE | Name</code>.</small>
        </label>
        <label>
          <span class="form-label">Sections</span>
          <textarea
            v-model="orgForm.sectionsText"
            class="form-input font-mono !text-xs"
            rows="8"
            placeholder="One per line&#10;Operations Division | Field Operations Section"
          ></textarea>
          <small class="block mt-1 text-[11px] text-slate-500">Use <code>Division | Section</code> so registration can filter correctly.</small>
        </label>
        <label class="lg:col-span-2">
          <span class="form-label">Requested Roles</span>
          <textarea
            v-model="orgForm.rolesText"
            class="form-input font-mono !text-xs"
            rows="4"
            placeholder="Technical Staff&#10;Section Head&#10;Division Chief"
          ></textarea>
          <small class="block mt-1 text-[11px] text-slate-500">Request choices only. An administrator still validates the approved role.</small>
        </label>
      </form>

      <!-- Parsing is shown back before saving, because the delimiter format is
           easy to get wrong and the failure is otherwise silent. -->
      <div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
        <p class="text-xs font-extrabold text-slate-700">This will be saved as</p>
        <p class="mt-1 text-xs text-slate-600">
          {{ parsedPreview.divisions }} division(s) ·
          {{ parsedPreview.sections }} section(s) ·
          {{ parsedPreview.roles }} requested role(s)
        </p>
        <p v-if="parsedPreview.orphanSections" class="mt-1 text-xs font-bold text-amber-700">
          {{ parsedPreview.orphanSections }} section(s) have no matching division and will not be filterable at registration.
        </p>
      </div>

      <div v-if="orgError" class="rounded-xl border border-red-100 bg-red-50 px-3 py-2" role="alert">
        <p class="text-xs text-red-700">{{ orgError }}</p>
      </div>

      <template #footer>
        <button class="btn-secondary" type="button" :disabled="orgSaving" @click="closeOrgOptionsModal">Cancel</button>
        <button class="btn-primary" type="submit" form="org-form" :disabled="orgSaving">
          {{ orgSaving ? 'Saving...' : 'Save Registration Options' }}
        </button>
      </template>
    </AppModal>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { officeRegistryApi } from '@/services/api'
import { usePermissions } from '@/composables/usePermissions'
import PageHeader from '@/components/ui/PageHeader.vue'
import DataPanel from '@/components/ui/DataPanel.vue'
import StatusPill from '@/components/ui/StatusPill.vue'
import AppModal from '@/components/ui/AppModal.vue'

const { canManageOfficeRegistry, canViewClusterMonitoring } = usePermissions()

const PROVISION_STEPS = [
  'Validate office code and details',
  'Create the evaluation-only spreadsheet',
  'Initialize tabs, headers and reference content',
  'Register and validate the schema'
]

const offices = ref([])
const loading = ref(false)
const saving = ref(false)
const busyId = ref('')
const busyAction = ref('')
const error = ref('')
const modalError = ref('')
const search = ref('')
const showProvisionModal = ref(false)
const showOrgModal = ref(false)
const lastValidation = ref(null)
const lastUpdatedAt = ref(null)
const orgOffice = ref(null)
const orgError = ref('')
const orgSaving = ref(false)
const orgForm = ref({ divisionsText: '', sectionsText: '', rolesText: '' })
const form = ref(defaultForm())

onMounted(loadOffices)

function defaultForm() {
  return { officeCode: '', officeName: '', officeShortName: '', primaryAdminEmail: '' }
}

const filteredOffices = computed(() => {
  const term = search.value.trim().toLowerCase()
  if (!term) return offices.value
  return offices.value.filter(office =>
    [office.officeCode, office.officeName, office.primaryAdminEmail]
      .some(field => String(field || '').toLowerCase().includes(term))
  )
})

const lastUpdatedLabel = computed(() =>
  lastUpdatedAt.value ? lastUpdatedAt.value.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''
)

const parsedPreview = computed(() => {
  const divisions = parseDivisionLines(orgForm.value.divisionsText)
  const sections = parseSectionLines(orgForm.value.sectionsText)
  const divisionNames = new Set(divisions.map(d => String(d.name).toLowerCase()))
  return {
    divisions: divisions.length,
    sections: sections.length,
    roles: parseSimpleLines(orgForm.value.rolesText).length,
    orphanSections: sections.filter(s => !s.divisionName || !divisionNames.has(String(s.divisionName).toLowerCase())).length
  }
})

// Provisioning runs as one backend call, so step state is derived rather than
// streamed: idle before submit, all active while in flight, all done on success.
function stepState(index) {
  if (saving.value) return 'active'
  if (lastValidation.value?.valid) return 'done'
  if (lastValidation.value && index < PROVISION_STEPS.length - 1) return 'done'
  return 'idle'
}

function isStbOffice(office) {
  return String(office?.officeId || office?.officeCode || '').toUpperCase() === 'STB'
}

function canActivate(office) {
  return office.spreadsheetStatus === 'FOR_VALIDATION'
}

function activateHint(office) {
  if (canActivate(office)) return 'Activate this office for the assessment portal'
  if (office.spreadsheetStatus === 'ACTIVE') return 'This office is already active'
  if (!office.spreadsheetStatus || office.spreadsheetStatus === 'NOT_PROVISIONED') return 'Provision the office spreadsheet first'
  return 'Run Validate first — activation requires a passing schema validation'
}

function needsResume(office) {
  return ['PROVISIONING', 'INVALID_SCHEMA'].includes(String(office.spreadsheetStatus || ''))
}

async function loadOffices() {
  loading.value = true
  error.value = ''
  try {
    const data = await officeRegistryApi.list({ pageSize: 200 })
    offices.value = data.items || []
    lastUpdatedAt.value = new Date()
  } catch (e) {
    error.value = e?.message || 'Please check your connection and try again.'
  } finally {
    loading.value = false
  }
}

function openProvisionModal() {
  form.value = defaultForm()
  modalError.value = ''
  lastValidation.value = null
  showProvisionModal.value = true
}

function closeProvisionModal() {
  if (saving.value) return
  showProvisionModal.value = false
}

async function provisionOffice() {
  saving.value = true
  modalError.value = ''
  lastValidation.value = null
  try {
    const result = await officeRegistryApi.provision({
      ...form.value,
      officeCode: form.value.officeCode.toUpperCase()
    })
    lastValidation.value = result.validation || null
    await loadOffices()
    if (result.validation?.valid) showProvisionModal.value = false
  } catch (e) {
    modalError.value = e?.message || 'Please try again, or check the registry for a partial row.'
    await loadOffices()
  } finally {
    saving.value = false
  }
}

async function validateOffice(office) {
  await runOfficeAction(office, 'validate', () => officeRegistryApi.validate(office.officeId), 'Could not validate this office.')
}

async function activateOffice(office) {
  await runOfficeAction(office, 'activate', () => officeRegistryApi.activate(office.officeId), 'Could not activate this office.')
}

async function runOfficeAction(office, action, work, fallbackMessage) {
  busyId.value = office.officeId
  busyAction.value = action
  error.value = ''
  try {
    await work()
    await loadOffices()
  } catch (e) {
    error.value = e?.message || fallbackMessage
  } finally {
    busyId.value = ''
    busyAction.value = ''
  }
}

async function openOrgOptionsModal(office) {
  orgOffice.value = office
  orgError.value = ''
  orgForm.value = {
    divisionsText: '',
    sectionsText: '',
    rolesText: 'Technical Staff\nSection Head\nDivision Chief\nAssistant Bureau Director\nBureau Director'
  }
  showOrgModal.value = true
  try {
    const data = await officeRegistryApi.orgOptions(office.officeId)
    const divisions = data.divisions || []
    const divisionNameById = Object.fromEntries(divisions.map(item => [item.id, item.name]))
    orgForm.value = {
      divisionsText: divisions.map(item => (item.code ? `${item.code} | ${item.name}` : item.name)).join('\n'),
      sectionsText: (data.sections || []).map(item => {
        const divisionName = divisionNameById[item.divisionId] || item.divisionId || ''
        return divisionName ? `${divisionName} | ${item.name}` : item.name
      }).join('\n'),
      rolesText: (data.requestedRoles || []).join('\n')
    }
  } catch (e) {
    orgError.value = e?.message || 'Could not load registration options.'
  }
}

function closeOrgOptionsModal() {
  if (orgSaving.value) return
  showOrgModal.value = false
}

async function saveOrgOptions() {
  if (!orgOffice.value) return
  orgSaving.value = true
  orgError.value = ''
  try {
    await officeRegistryApi.saveOrgOptions(orgOffice.value.officeId, {
      divisions: parseDivisionLines(orgForm.value.divisionsText),
      sections: parseSectionLines(orgForm.value.sectionsText),
      requestedRoles: parseSimpleLines(orgForm.value.rolesText).map(name => ({ name }))
    })
    showOrgModal.value = false
  } catch (e) {
    orgError.value = e?.message || 'Could not save registration options.'
  } finally {
    orgSaving.value = false
  }
}

function parseSimpleLines(value) {
  return String(value || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean)
}

function parseDivisionLines(value) {
  return parseSimpleLines(value).map(line => {
    const parts = line.split('|').map(part => part.trim()).filter(Boolean)
    return parts.length > 1 ? { code: parts[0], name: parts.slice(1).join(' | ') } : { name: parts[0] }
  })
}

function parseSectionLines(value) {
  return parseSimpleLines(value).map(line => {
    const parts = line.split('|').map(part => part.trim()).filter(Boolean)
    return parts.length > 1
      ? { divisionName: parts[0], name: parts.slice(1).join(' | ') }
      : { name: parts[0] }
  })
}

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
}
</script>
