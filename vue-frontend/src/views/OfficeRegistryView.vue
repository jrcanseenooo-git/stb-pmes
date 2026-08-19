<template>
  <div class="pui-page">
    <PageHeader
      v-if="!props.embedded"
      :kicker="centralRegistryMode ? 'Central Administration' : 'Office Administration'"
      :title="centralRegistryMode ? 'Office Registry' : 'Office Structure'"
      :subtitle="centralRegistryMode
        ? 'Provision, validate and activate evaluation-only spreadsheets for participating offices.'
        : `Maintain the registration divisions, sections and role choices for ${ownOffice.officeName || 'your office'}.`"
    >
      <template #actions>
        <RouterLink v-if="centralRegistryMode && canViewClusterMonitoring" to="/cluster-overview" class="pui-btn">Cluster Overview</RouterLink>
        <button v-if="canManageOfficeRegistry" class="pui-btn pui-btn-primary" type="button" @click="openProvisionModal">Add Office</button>
        <button v-if="ownOfficeStructureMode" class="pui-btn pui-btn-primary" type="button" @click="openOrgOptionsModal(ownOffice)">
          Configure
        </button>
      </template>
    </PageHeader>

    <DataPanel
      v-if="centralRegistryMode"
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
        <button class="pui-btn pui-btn-primary" type="button" @click="openProvisionModal">Add Office</button>
      </template>

      <table class="pui-table">
        <thead>
          <tr>
            <th scope="col">Office</th>
            <th scope="col">Primary Admin</th>
            <th scope="col">Office Status</th>
            <th scope="col">Portal Status</th>
            <th scope="col">Last Validated</th>
            <th scope="col" style="text-align:right;">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="office in filteredOffices" :key="office.officeId">
            <td>
              <strong>{{ officeDisplayCode(office) }}</strong>
              <small>{{ office.officeName }}</small>
            </td>
            <td style="white-space:nowrap;">{{ office.primaryAdminEmail || '-' }}</td>
            <td><StatusPill :status="office.officeStatus || 'DRAFT'" :label="officeRegistryStatusLabel(office.officeStatus)" /></td>
            <td>
              <StatusPill :status="office.spreadsheetStatus || 'NOT_PROVISIONED'" :label="officeRegistryStatusLabel(office.spreadsheetStatus)" />
              <!-- A registry row left mid-provisioning is recoverable, not broken.
                   Provisioning has timed out in production before, so the resume
                   path is stated rather than left for the operator to infer. -->
              <template v-if="office.spreadsheetStatus === 'INVALID_SCHEMA'">
                <small v-if="office.provisioningError" style="display:block; color:#b91c1c; font-weight:700; margin-top:3px; max-width:260px;">
                  {{ office.provisioningError }}
                </small>
                <small v-else style="display:block; color:#b45309; font-weight:700; margin-top:3px;">
                  Schema validation failed - run Validate again to see the specific reason.
                </small>
              </template>
              <small v-else-if="needsResume(office)" style="display:block; color:#b45309; font-weight:700; margin-top:3px;">
                Setup incomplete - run Validate, then Activate.
              </small>
            </td>
            <td style="white-space:nowrap;">{{ formatDate(office.lastValidatedAt) }}</td>
            <td>
              <div style="display:flex; align-items:center; justify-content:flex-end; gap:6px; flex-wrap:wrap;">
                <template v-if="canManageOfficeRegistry">
                  <button
                    v-if="!isStbOffice(office)"
                    class="pui-btn pui-btn-sm"
                    type="button"
                    :disabled="isOfficeBusy(office)"
                    title="Check the office spreadsheet against the required schema"
                    @click="validateOffice(office)"
                  >
                    {{ officeBusyAction(office) === 'validate' ? 'Validating...' : 'Validate' }}
                  </button>
                  <button
                    v-if="!isStbOffice(office) && office.spreadsheetStatus === 'INVALID_SCHEMA'"
                    class="pui-btn pui-btn-sm"
                    type="button"
                    :disabled="isOfficeBusy(office)"
                    title="Add any headers the schema now requires that this spreadsheet predates. Does not touch existing data - a missing sheet or duplicate header still needs a person."
                    @click="repairOffice(office)"
                  >
                    {{ officeBusyAction(office) === 'repair' ? 'Repairing...' : 'Repair' }}
                  </button>
                  <button
                    v-if="!isStbOffice(office)"
                    class="pui-btn pui-btn-sm"
                    type="button"
                    :disabled="isOfficeBusy(office) || !canActivate(office)"
                    :title="activateHint(office)"
                    @click="activateOffice(office)"
                  >
                    {{ officeBusyAction(office) === 'activate' ? 'Activating...' : 'Activate' }}
                  </button>
                  <span v-if="isStbOffice(office)" style="font-size:11px; font-weight:700; color:#64748b;">Central PMES</span>
                  <button
                    class="pui-btn pui-btn-sm"
                    type="button"
                    :disabled="isOfficeBusy(office)"
                    title="Configure the divisions, sections and roles offered at registration"
                    @click="openOrgOptionsModal(office)"
                  >
                    Configure
                  </button>
                </template>
                <span v-else style="font-size:11px; font-weight:700; color:#64748b;">Monitoring only</span>
              </div>
              <small
                v-if="officeActionMessage(office)"
                :class="['office-action-message', `office-action-message-${officeActionMessage(office).type}`]"
                aria-live="polite"
              >
                {{ officeActionMessage(office).text }}
              </small>
            </td>
          </tr>
        </tbody>
      </table>
    </DataPanel>

    <DataPanel
      v-else
      title="Registration Options"
      :subtitle="ownOffice.officeName || ownOffice.officeCode || 'Your office'"
      :loading="loading"
      :error="error"
      error-title="The office structure could not be loaded"
      :empty="false"
      refreshable
      :last-updated="lastUpdatedLabel"
      @refresh="loadOffices"
    >
      <table class="pui-table">
        <thead>
          <tr>
            <th scope="col">Office</th>
            <th scope="col">Available Action</th>
            <th scope="col" style="text-align:right;">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <strong>{{ officeDisplayCode(ownOffice) }}</strong>
              <small>{{ ownOffice.officeName }}</small>
            </td>
            <td>Configure divisions, sections and registration role choices for this office only.</td>
            <td>
              <div style="display:flex; justify-content:flex-end;">
                <button class="pui-btn pui-btn-sm" type="button" @click="openOrgOptionsModal(ownOffice)">
                  Configure
                </button>
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
      <form id="provision-form" class="pui-grid pui-grid-2" @submit.prevent="provisionOffice">
        <label>
          <span class="pui-label">Office Code</span>
          <input v-model="form.officeCode" class="pui-input" type="text" placeholder="EPAHP" required :disabled="saving" />
        </label>
        <label>
          <span class="pui-label">Office Short Name</span>
          <input v-model="form.officeShortName" class="pui-input" type="text" placeholder="EPAHP" :disabled="saving" />
        </label>
        <label class="pui-span-2">
          <span class="pui-label">Office Name</span>
          <input
            v-model="form.officeName"
            class="pui-input"
            type="text"
            placeholder="Enhanced Partnership Against Hunger and Poverty"
            required
            :disabled="saving"
          />
        </label>
        <label class="pui-span-2">
          <span class="pui-label">Primary Office Admin Email</span>
          <input v-model="form.primaryAdminEmail" class="pui-input" type="email" placeholder="admin@dswd.gov.ph" required :disabled="saving" />
        </label>
      </form>

      <!-- Provisioning is a multi-step backend operation that can exceed the
           Apps Script execution window. Showing the steps means an operator who
           hits a timeout knows which stage was reached. -->
      <ol style="list-style:none; margin:0; padding:0; border:1px solid #e2e8f0; border-radius:10px; overflow:hidden;">
        <li
          v-for="(step, index) in PROVISION_STEPS"
          :key="step"
          :style="{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px', borderTop: index ? '1px solid #eef2f7' : 'none' }"
        >
          <span
            :style="{
              width: '20px', height: '20px', borderRadius: '999px', flexShrink: 0,
              display: 'grid', placeItems: 'center', fontSize: '10px', fontWeight: 800,
              background: stepState(index) === 'done' ? '#d1fae5' : stepState(index) === 'active' ? '#0b3b75' : '#f1f5f9',
              color: stepState(index) === 'done' ? '#047857' : stepState(index) === 'active' ? '#fff' : '#94a3b8'
            }"
          >
            {{ stepState(index) === 'done' ? '✓' : index + 1 }}
          </span>
          <span :style="{ fontSize: '12px', fontWeight: stepState(index) === 'idle' ? 500 : 700, color: stepState(index) === 'idle' ? '#94a3b8' : '#334155' }">
            {{ step }}
          </span>
        </li>
      </ol>

      <div v-if="modalError" class="pui-alert pui-alert-error" role="alert">
        <p class="pui-alert-title">Provisioning did not complete</p>
        <p>{{ modalError }}</p>
        <p style="margin-top:6px;">
          If a partial office row now appears in the registry, do not add the office again -
          use Validate and then Activate on the existing row.
        </p>
      </div>

      <div v-if="lastValidation" class="pui-alert pui-alert-info">
        <p class="pui-alert-title" style="color:#1e3a8a;">
          {{ lastValidation.valid ? 'Schema validation passed' : 'Schema validation needs attention' }}
        </p>
        <ul v-if="lastValidation.errors?.length" style="margin:6px 0 0; padding-left:18px;">
          <li v-for="item in lastValidation.errors" :key="item">{{ item }}</li>
        </ul>
      </div>

      <template #footer>
        <button class="pui-btn" type="button" :disabled="saving" @click="closeProvisionModal">Cancel</button>
        <button class="pui-btn pui-btn-primary" type="submit" form="provision-form" :disabled="saving">
          {{ saving ? 'Provisioning...' : 'Create Evaluation Spreadsheet' }}
        </button>
      </template>
    </AppModal>

    <!-- Registration options -->
    <AppModal
      :show="showOrgModal"
      title="Configure Registration Options"
      :description="`${orgOffice?.officeName || 'Office'} divisions, sections and requested roles.`"
      wide
      :busy="orgSaving || orgLoading"
      @close="closeOrgOptionsModal"
    >
      <div v-if="orgLoading" class="org-loading" role="status" aria-live="polite">
        <span class="org-loading-spinner" aria-hidden="true"></span>
        <div>
          <p class="org-loading-title">Loading registration options</p>
          <p class="pui-hint">Reading the current divisions, sections and roles from the database...</p>
        </div>
      </div>

      <form v-else id="org-form" style="display:grid; gap:16px;" @submit.prevent="saveOrgOptions">
        <label>
          <span class="pui-label">Divisions / Units</span>
          <div class="numbered-textarea">
            <ol class="line-number-gutter" aria-hidden="true">
              <li v-for="(line, index) in numberedEntries(orgForm.divisionsText)" :key="`${index}-${line}`">
                <span class="line-number-value">{{ index + 1 }}</span>
                <span class="line-number-measure">{{ line || ' ' }}</span>
              </li>
            </ol>
            <textarea
              v-autosize
              v-model="orgForm.divisionsText"
              class="pui-textarea numbered-input"
              :rows="textareaRows(orgForm.divisionsText, 3)"
              placeholder="One per line&#10;Operations Division&#10;ADMIN | Administrative Unit"
            ></textarea>
          </div>
          <small class="pui-hint">One line per unit. Optional format: <code>CODE | Name</code>.</small>
        </label>

        <div>
          <span class="pui-label">Sections</span>
          <!--
            Sections are entered under their division rather than as a second
            free-text list that has to repeat the division name on every line.
            With several divisions each carrying a few sections, retyping the
            division name that many times is exactly where a typo silently
            orphans a section - it stops matching its parent division and
            never appears in the registration form's Section dropdown, with
            no error shown anywhere. Grouping by division removes the free-text
            name entirely, so that failure mode can't happen.
          -->
          <div v-if="!parsedDivisionNames.length" class="pui-hint" style="margin-top:4px;">
            Enter divisions above first - a section box appears for each one.
          </div>
          <div v-else class="org-section-grid">
            <div v-for="name in parsedDivisionNames" :key="name" class="org-section-card">
              <p class="org-section-title">{{ name }}</p>
              <div class="numbered-textarea">
                <ol class="line-number-gutter" aria-hidden="true">
                  <li v-for="(line, index) in numberedEntries(sectionsByDivision[name])" :key="`${index}-${line}`">
                    <span class="line-number-value">{{ index + 1 }}</span>
                    <span class="line-number-measure">{{ line || ' ' }}</span>
                  </li>
                </ol>
                <textarea
                  v-autosize
                  v-model="sectionsByDivision[name]"
                  class="pui-textarea numbered-input"
                  :rows="textareaRows(sectionsByDivision[name], 2)"
                  placeholder="One section per line"
                ></textarea>
              </div>
            </div>
          </div>
        </div>

        <label>
          <span class="pui-label">Requested Roles</span>
          <div class="numbered-textarea">
            <ol class="line-number-gutter" aria-hidden="true">
              <li v-for="(line, index) in numberedEntries(orgForm.rolesText)" :key="`${index}-${line}`">
                <span class="line-number-value">{{ index + 1 }}</span>
                <span class="line-number-measure">{{ line || ' ' }}</span>
              </li>
            </ol>
            <textarea
              v-autosize
              v-model="orgForm.rolesText"
              class="pui-textarea numbered-input"
              :rows="textareaRows(orgForm.rolesText, 3)"
              placeholder="Technical Staff&#10;Section Head&#10;Division Chief"
            ></textarea>
          </div>
          <small class="pui-hint">Request choices only. An administrator still validates the approved role.</small>
        </label>
      </form>

      <div v-if="!orgLoading" class="pui-alert" style="background:#f8fafc; border:1px solid #e2e8f0; color:#334155;">
        <p class="pui-alert-title" style="color:#334155;">This will be saved as</p>
        <p>
          {{ parsedPreview.divisions }} division(s) ·
          {{ parsedPreview.sections }} section(s) ·
          {{ parsedPreview.roles }} requested role(s)
        </p>
      </div>

      <div v-if="orgError" class="pui-alert pui-alert-error" role="alert">
        <p>{{ orgError }}</p>
      </div>

      <template #footer>
        <button class="pui-btn" type="button" :disabled="orgSaving" @click="closeOrgOptionsModal">Cancel</button>
        <button class="pui-btn pui-btn-primary" type="submit" form="org-form" :disabled="orgSaving || orgLoading">
          {{ orgSaving ? 'Saving...' : 'Save Registration Options' }}
        </button>
      </template>
    </AppModal>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { useToast } from 'vue-toastification'
import { officeRegistryApi } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import { usePermissions } from '@/composables/usePermissions'
import { useConfirm } from '@/composables/useConfirm'
import { officeAcronym } from '@/utils/officeAcronyms'
import PageHeader from '@/components/ui/PageHeader.vue'
import DataPanel from '@/components/ui/DataPanel.vue'
import StatusPill from '@/components/ui/StatusPill.vue'
import AppModal from '@/components/ui/AppModal.vue'

const authStore = useAuthStore()
const { canManageOfficeRegistry, canConfigureOfficeStructure, canViewClusterMonitoring } = usePermissions()
const { confirm } = useConfirm()
const toast = useToast()

const props = defineProps({
  embedded: { type: Boolean, default: false }
})

const vAutosize = {
  mounted: autosizeTextarea,
  updated: autosizeTextarea
}

const PROVISION_STEPS = [
  'Validate office code and details',
  'Create the evaluation-only spreadsheet',
  'Initialize tabs, headers and reference content',
  'Register and validate the schema'
]

const offices = ref([])
const loading = ref(false)
const saving = ref(false)
const officeActionState = ref({})
const officeActionMessages = ref({})
const error = ref('')
const modalError = ref('')
const search = ref('')
const showProvisionModal = ref(false)
const showOrgModal = ref(false)
const lastValidation = ref(null)
const lastUpdatedAt = ref(null)
const orgOffice = ref(null)
const orgError = ref('')
const orgLoading = ref(false)
const orgSaving = ref(false)
const orgForm = ref({ divisionsText: '', rolesText: '' })
const sectionsByDivision = ref({})
const form = ref(defaultForm())

onMounted(loadOffices)

const centralRegistryMode = computed(() => canManageOfficeRegistry.value || canViewClusterMonitoring.value)
const ownOfficeStructureMode = computed(() => !centralRegistryMode.value && canConfigureOfficeStructure.value)
const ownOffice = computed(() => {
  const profile = authStore.profile || {}
  return {
    officeId: profile.officeId || profile.officeCode || '',
    officeCode: profile.officeCode || profile.officeId || '',
    officeShortName: profile.officeShortName || profile.officeCode || profile.officeId || '',
    officeName: profile.officeName || profile.office || profile.officeCode || 'Your office'
  }
})

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

const parsedPreview = computed(() => ({
  divisions: parsedDivisions.value.length,
  sections: sectionsFromGroupedInputs().length,
  roles: parseSimpleLines(orgForm.value.rolesText).length
}))

const parsedDivisions = computed(() => parseDivisionLines(orgForm.value.divisionsText))
const parsedDivisionNames = computed(() => parsedDivisions.value.map(item => item.name).filter(Boolean))

watch(parsedDivisionNames, names => {
  const next = {}
  names.forEach(name => {
    next[name] = sectionsByDivision.value[name] || ''
  })
  sectionsByDivision.value = next
}, { immediate: true })

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

function officeDisplayCode(office) {
  return officeAcronym(office) || office?.officeCode || ''
}

function officeRegistryStatusLabel(status) {
  return String(status || '').trim().toUpperCase() === 'ACTIVE' ? 'Activated' : ''
}

function canActivate(office) {
  return office.spreadsheetStatus === 'FOR_VALIDATION'
}

function activateHint(office) {
  if (canActivate(office)) return 'Activate this office for the assessment portal'
  if (office.spreadsheetStatus === 'ACTIVE') return 'This office is already active'
  if (!office.spreadsheetStatus || office.spreadsheetStatus === 'NOT_PROVISIONED') return 'Provision the office spreadsheet first'
  return 'Run Validate first - activation requires a passing schema validation'
}

function officeKey(office) {
  return String(office?.officeId || office?.officeCode || '').trim()
}

function officeBusyAction(office) {
  return officeActionState.value[officeKey(office)] || ''
}

function isOfficeBusy(office) {
  return !!officeBusyAction(office)
}

function officeActionMessage(office) {
  return officeActionMessages.value[officeKey(office)] || null
}

function setOfficeActionState(office, action) {
  const key = officeKey(office)
  if (!key) return
  officeActionState.value = { ...officeActionState.value, [key]: action }
}

function clearOfficeActionState(office) {
  const key = officeKey(office)
  if (!key) return
  const next = { ...officeActionState.value }
  delete next[key]
  officeActionState.value = next
}

function setOfficeActionMessage(office, type, text) {
  const key = officeKey(office)
  if (!key) return
  officeActionMessages.value = {
    ...officeActionMessages.value,
    [key]: { type, text }
  }
}

function needsResume(office) {
  return ['PROVISIONING', 'INVALID_SCHEMA'].includes(String(office.spreadsheetStatus || ''))
}

async function loadOffices() {
  loading.value = true
  error.value = ''
  try {
    if (centralRegistryMode.value) {
      const data = await officeRegistryApi.list({ pageSize: 200 })
      offices.value = data.items || []
    } else {
      offices.value = ownOffice.value.officeId ? [ownOffice.value] : []
    }
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
  const ok = await confirm({
    title: 'Provision Office',
    message: `A new evaluation-only Google Spreadsheet will be created for ${form.value.officeName || 'this office'} and registered centrally. This creates real infrastructure - it is not something to undo casually.`,
    confirmLabel: 'Create Spreadsheet'
  })
  if (!ok) return

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
  const ok = await confirm({
    title: 'Validate Office Spreadsheet',
    message: `Check ${office.officeName || office.officeCode}'s spreadsheet against the required schema. The spreadsheet's contents are not modified - only the recorded validation result is updated.`,
    note: 'An office that is already active stays active if the check passes. If the check fails it is marked "Needs Repair" and its portal stops being served until it is fixed.',
    confirmLabel: 'Validate'
  })
  if (!ok) return
  await runOfficeAction(office, 'validate', () => officeRegistryApi.validate(office.officeId), 'Could not validate this office.')
}

async function repairOffice(office) {
  const ok = await confirm({
    title: 'Repair Office Spreadsheet',
    message: `Adds any headers the current schema requires that ${office.officeName || office.officeCode}'s spreadsheet is missing. Existing rows and data are never touched.`,
    note: 'If the failure is something other than missing headers - a missing sheet or a duplicate column - this will not fix it, and Validate will still report what remains.',
    confirmLabel: 'Repair'
  })
  if (!ok) return
  await runOfficeAction(office, 'repair', () => officeRegistryApi.repair(office.officeId), 'Could not repair this office.')
}

async function activateOffice(office) {
  const ok = await confirm({
    title: 'Activate Office',
    message: `${office.officeName || office.officeCode} will become active in the Innovation Cluster Personnel Assessment Portal. Its personnel will be able to sign in and receive rating assignments.`,
    confirmLabel: 'Activate'
  })
  if (!ok) return
  await runOfficeAction(office, 'activate', () => officeRegistryApi.activate(office.officeId), 'Could not activate this office.')
}

async function runOfficeAction(office, action, work, fallbackMessage) {
  const officeName = office.officeName || officeDisplayCode(office) || 'Office'
  const labels = {
    validate: ['Validating', 'validated'],
    repair: ['Repairing', 'repaired'],
    activate: ['Activating', 'activated']
  }
  const [activeLabel, doneLabel] = labels[action] || ['Processing', 'updated']

  setOfficeActionState(office, action)
  setOfficeActionMessage(office, 'pending', `${activeLabel} ${officeName}...`)
  toast.info(`${activeLabel} ${officeName}...`)
  error.value = ''
  try {
    await work()
    setOfficeActionMessage(office, 'success', `${officeName} ${doneLabel}.`)
    toast.success(`${officeName} ${doneLabel}.`)
    await loadOffices()
  } catch (e) {
    const message = e?.message || fallbackMessage
    setOfficeActionMessage(office, 'error', message)
    toast.error(`${officeName}: ${message}`)
  } finally {
    clearOfficeActionState(office)
  }
}

async function openOrgOptionsModal(office) {
  orgOffice.value = office
  orgError.value = ''
  orgLoading.value = true
  orgForm.value = { divisionsText: '', rolesText: '' }
  sectionsByDivision.value = {}
  showOrgModal.value = true
  try {
    const data = await officeRegistryApi.orgOptions(office.officeId)
    const divisions = data.divisions || []
    const divisionNameById = Object.fromEntries(divisions.map(item => [item.id, item.name]))
    const groupedSections = {}
    ;(data.sections || []).forEach(item => {
      const divisionName = divisionNameById[item.divisionId] || item.divisionId || ''
      if (!divisionName) return
      if (!groupedSections[divisionName]) groupedSections[divisionName] = []
      groupedSections[divisionName].push(item.name)
    })
    orgForm.value = {
      divisionsText: divisions.map(item => (item.code ? `${item.code} | ${item.name}` : item.name)).join('\n'),
      rolesText: (data.requestedRoles || []).join('\n')
    }
    sectionsByDivision.value = Object.fromEntries(
      divisions.map(item => [item.name, (groupedSections[item.name] || []).join('\n')])
    )
  } catch (e) {
    orgError.value = e?.message || 'Could not load registration options.'
  } finally {
    orgLoading.value = false
  }
}

function closeOrgOptionsModal() {
  if (orgSaving.value) return
  showOrgModal.value = false
}

async function saveOrgOptions() {
  if (!orgOffice.value) return
  const ok = await confirm({
    title: 'Save Registration Options',
    message: `This replaces the current divisions, sections and requested roles for ${orgOffice.value.officeName || 'this office'} with ${parsedPreview.value.divisions} division(s), ${parsedPreview.value.sections} section(s) and ${parsedPreview.value.roles} requested role(s).`,
    confirmLabel: 'Save'
  })
  if (!ok) return

  orgSaving.value = true
  orgError.value = ''
  try {
    await officeRegistryApi.saveOrgOptions(orgOffice.value.officeId, {
      divisions: parseDivisionLines(orgForm.value.divisionsText),
      sections: sectionsFromGroupedInputs(),
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

function sectionsFromGroupedInputs() {
  return parsedDivisionNames.value.flatMap(divisionName =>
    parseSimpleLines(sectionsByDivision.value[divisionName]).map(name => ({
      divisionName,
      name
    }))
  )
}

function numberedEntries(value) {
  const entries = String(value || '').split(/\r?\n/)
  return entries.length ? entries : ['']
}

function textareaRows(value, minRows = 2) {
  return Math.max(minRows, String(value || '').split(/\r?\n/).length)
}

function autosizeTextarea(el) {
  requestAnimationFrame(() => {
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  })
}

function formatDate(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
}
</script>

<style scoped>
.org-loading {
  min-height: 220px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding: 28px;
  color: #334155;
}

.org-loading-spinner {
  width: 28px;
  height: 28px;
  border: 3px solid #dbeafe;
  border-top-color: #0f4c9a;
  border-radius: 50%;
  animation: org-spin 0.85s linear infinite;
  flex: 0 0 auto;
}

.org-loading-title {
  margin: 0 0 4px;
  color: #0f172a;
  font-weight: 800;
}

.office-action-message {
  display: block;
  margin-top: 6px;
  text-align: right;
  font-size: 11px;
  font-weight: 800;
  line-height: 1.25;
}

.office-action-message-pending {
  color: #1d4ed8;
}

.office-action-message-success {
  color: #047857;
}

.office-action-message-error {
  color: #b91c1c;
}

@keyframes org-spin {
  to { transform: rotate(360deg); }
}

.org-section-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 12px;
  margin-top: 8px;
  overflow: hidden;
}

.org-section-card {
  min-width: 0;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 10px;
  background: #fafcff;
}

.org-section-card textarea {
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
}

.org-section-title {
  margin: 0 0 6px;
  color: #0f172a;
  font-size: 11.5px;
  font-weight: 800;
  overflow-wrap: anywhere;
}

.numbered-textarea {
  position: relative;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  overflow: hidden;
  background: #fff;
}

.numbered-textarea:focus-within {
  border-color: #2563eb;
  box-shadow: 0 0 0 1px #2563eb;
}

.line-number-gutter {
  position: absolute;
  inset: 0;
  z-index: 0;
  margin: 0;
  padding: 9px 0;
  list-style: none;
  overflow: hidden;
  background: #f8fafc;
  color: #64748b;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
  font-size: 12px;
  line-height: 18px;
  pointer-events: none;
}

.line-number-gutter li {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr);
  min-height: 18px;
}

.line-number-value {
  padding-right: 8px;
  border-right: 1px solid #e2e8f0;
  text-align: right;
}

.line-number-measure {
  visibility: hidden;
  padding: 0 10px 0 12px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.numbered-input {
  position: relative;
  z-index: 1;
  width: 100%;
  min-width: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
  font-size: 12px;
  line-height: 18px;
  overflow: hidden;
  padding: 9px 10px 9px 46px;
  resize: none;
}

.numbered-input:focus {
  outline: none;
  box-shadow: none;
}

@media (max-width: 760px) {
  .org-section-grid {
    grid-template-columns: 1fr;
  }
}
</style>
