<template>
  <section class="or-page">
    <div class="or-toolbar">
      <div>
        <p class="or-kicker">Central Administration</p>
        <h1>Office Registry</h1>
        <p class="or-sub">Provision and validate evaluation-only office spreadsheets for the Innovation Cluster portal.</p>
      </div>
      <button v-if="canManageOfficeRegistry" class="or-btn primary" type="button" @click="openProvisionModal">Add Office</button>
    </div>

    <div class="or-monitor-panel">
      <div class="or-panel-hd">
        <div>
          <h2>Cluster Monitoring</h2>
          <p>{{ monitoringLoading ? 'Refreshing office summaries...' : 'Assessment status across participating offices' }}</p>
        </div>
        <button class="or-btn" type="button" :disabled="monitoringLoading" @click="loadMonitoring">
          {{ monitoringLoading ? 'Refreshing...' : 'Refresh Monitoring' }}
        </button>
      </div>

      <div class="or-stat-grid">
        <div class="or-stat">
          <span>Active Offices</span>
          <strong>{{ monitoringTotals.activeOffices }}/{{ monitoringTotals.offices }}</strong>
        </div>
        <div class="or-stat">
          <span>Personnel</span>
          <strong>{{ monitoringTotals.personnel }}</strong>
        </div>
        <div class="or-stat">
          <span>Assessments</span>
          <strong>{{ monitoringTotals.assessmentRecords }}</strong>
        </div>
        <div class="or-stat">
          <span>Pending Ratings</span>
          <strong>{{ monitoringTotals.pendingAssignments }}</strong>
        </div>
      </div>

      <div v-if="monitoringError" class="or-error">{{ monitoringError }}</div>
      <div v-else-if="!monitoringItems.length && !monitoringLoading" class="or-empty">No office monitoring data yet.</div>
      <div v-else class="or-table-wrap">
        <table class="or-table or-monitor-table">
          <thead>
            <tr>
              <th>Office</th>
              <th>Health</th>
              <th>Personnel</th>
              <th>Assessments</th>
              <th>Assignments</th>
              <th>Average</th>
              <th>Last Activity</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="office in monitoringItems" :key="office.officeId">
              <td>
                <strong>{{ office.officeCode }}</strong>
                <span>{{ office.officeName }}</span>
              </td>
              <td>
                <span :class="['or-pill', healthClass(office.health)]">{{ office.health }}</span>
                <small v-if="office.healthNote" class="or-cell-note">{{ office.healthNote }}</small>
              </td>
              <td>{{ office.personnel.active }}/{{ office.personnel.total }} active</td>
              <td>{{ office.assessments.computed + office.assessments.final }}/{{ office.assessments.total }} scored</td>
              <td>{{ office.assignments.completed }}/{{ office.assignments.total }} completed</td>
              <td>{{ office.assessments.averageOverall ?? '-' }}</td>
              <td>{{ formatDate(office.lastActivityAt) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="or-panel">
      <div class="or-panel-hd">
        <div>
          <h2>Participating Offices</h2>
          <p>{{ total }} registered offices</p>
        </div>
        <div class="or-search">
          <input v-model="search" type="text" placeholder="Search office or admin..." @keyup.enter="refreshAll" />
          <button class="or-btn" type="button" @click="refreshAll">Search</button>
        </div>
      </div>

      <div v-if="loading" class="or-empty">Loading offices...</div>
      <div v-else-if="error" class="or-error">{{ error }}</div>
      <div v-else-if="!offices.length" class="or-empty">No offices registered yet.</div>
      <div v-else class="or-table-wrap">
        <table class="or-table">
          <thead>
            <tr>
              <th>Office</th>
              <th>Primary Admin</th>
              <th>Office Status</th>
              <th>Portal Status</th>
              <th>Last Validated</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="office in offices" :key="office.officeId">
              <td>
                <strong>{{ office.officeCode }}</strong>
                <span>{{ office.officeName }}</span>
              </td>
              <td>{{ office.primaryAdminEmail || '-' }}</td>
              <td><span :class="['or-pill', statusClass(office.officeStatus)]">{{ office.officeStatus || 'DRAFT' }}</span></td>
              <td><span :class="['or-pill', statusClass(office.spreadsheetStatus)]">{{ portalStatusLabel(office.spreadsheetStatus) }}</span></td>
              <td>{{ formatDate(office.lastValidatedAt) }}</td>
              <td>
                <div class="or-actions">
                  <template v-if="canManageOfficeRegistry && !isStbOffice(office)">
                    <button class="or-icon-btn" type="button" title="Validate schema" @click="validateOffice(office)" :disabled="busyId === office.officeId">Validate</button>
                    <button class="or-icon-btn" type="button" title="Activate office" @click="activateOffice(office)" :disabled="busyId === office.officeId || office.spreadsheetStatus !== 'FOR_VALIDATION'">Activate</button>
                    <button class="or-icon-btn" type="button" title="Configure registration options" @click="openOrgOptionsModal(office)" :disabled="busyId === office.officeId">Configure</button>
                  </template>
                  <span v-if="canManageOfficeRegistry && isStbOffice(office)" class="or-readonly">Central PMES</span>
                  <span v-if="!canManageOfficeRegistry" class="or-readonly">Monitoring only</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-if="showProvisionModal" class="or-modal-overlay" @click.self="closeProvisionModal">
      <form class="or-modal" @submit.prevent="provisionOffice">
        <div class="or-modal-hd">
          <div>
            <h2>Provision Office</h2>
            <p>Creates an evaluation-only spreadsheet through the protected backend process.</p>
          </div>
          <button class="or-close" type="button" @click="closeProvisionModal">x</button>
        </div>

        <div class="or-form-grid">
          <label>
            <span>Office Code</span>
            <input v-model="form.officeCode" type="text" placeholder="EPAHP" required />
          </label>
          <label>
            <span>Office Short Name</span>
            <input v-model="form.officeShortName" type="text" placeholder="EPAHP" />
          </label>
          <label class="wide">
            <span>Office Name</span>
            <input v-model="form.officeName" type="text" placeholder="Enhanced Partnership Against Hunger and Poverty" required />
          </label>
          <label class="wide">
            <span>Primary Office Admin Email</span>
            <input v-model="form.primaryAdminEmail" type="email" placeholder="admin@dswd.gov.ph" required />
          </label>
        </div>

        <div v-if="modalError" class="or-error compact">{{ modalError }}</div>
        <div v-if="lastValidation" class="or-validation">
          <strong>{{ lastValidation.valid ? 'Validation passed' : 'Validation needs attention' }}</strong>
          <ul v-if="lastValidation.errors?.length">
            <li v-for="item in lastValidation.errors" :key="item">{{ item }}</li>
          </ul>
        </div>

        <div class="or-modal-actions">
          <button class="or-btn" type="button" @click="closeProvisionModal">Cancel</button>
          <button class="or-btn primary" type="submit" :disabled="saving">
            {{ saving ? 'Provisioning...' : 'Create Evaluation Spreadsheet' }}
          </button>
        </div>
      </form>
    </div>

    <div v-if="showOrgModal" class="or-modal-overlay" @click.self="closeOrgOptionsModal">
      <form class="or-modal or-modal-wide" @submit.prevent="saveOrgOptions">
        <div class="or-modal-hd">
          <div>
            <h2>Configure Registration Options</h2>
            <p>{{ orgOffice?.officeName || 'Office' }} divisions, sections, and requested roles.</p>
          </div>
          <button class="or-close" type="button" @click="closeOrgOptionsModal">x</button>
        </div>

        <div class="or-config-grid">
          <label>
            <span>Divisions / Units</span>
            <textarea v-model="orgForm.divisionsText" rows="8" placeholder="One per line&#10;Example: Operations Division&#10;Example: ADMIN | Administrative Unit"></textarea>
            <small>Use one line per division or unit. Optional format: CODE | Name.</small>
          </label>
          <label>
            <span>Sections</span>
            <textarea v-model="orgForm.sectionsText" rows="8" placeholder="One per line&#10;Example: Operations Division | Field Operations Section&#10;Example: Administrative Unit | Records Section"></textarea>
            <small>Use Division/Unit | Section so the registration form can filter sections correctly.</small>
          </label>
          <label class="wide">
            <span>Requested Roles</span>
            <textarea v-model="orgForm.rolesText" rows="4" placeholder="Technical Staff&#10;Section Head&#10;Division Chief&#10;Office Admin"></textarea>
            <small>These are request choices only. The admin still validates the final approved role.</small>
          </label>
        </div>

        <div v-if="orgError" class="or-error compact">{{ orgError }}</div>

        <div class="or-modal-actions">
          <button class="or-btn" type="button" @click="closeOrgOptionsModal">Cancel</button>
          <button class="or-btn primary" type="submit" :disabled="orgSaving">
            {{ orgSaving ? 'Saving...' : 'Save Registration Options' }}
          </button>
        </div>
      </form>
    </div>
  </section>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { officeRegistryApi } from '@/services/api'
import { usePermissions } from '@/composables/usePermissions'

const { canManageOfficeRegistry } = usePermissions()

const offices = ref([])
const total = ref(0)
const loading = ref(false)
const monitoringLoading = ref(false)
const saving = ref(false)
const busyId = ref('')
const error = ref('')
const monitoringError = ref('')
const modalError = ref('')
const search = ref('')
const showProvisionModal = ref(false)
const showOrgModal = ref(false)
const lastValidation = ref(null)
const monitoringItems = ref([])
const orgOffice = ref(null)
const orgError = ref('')
const orgSaving = ref(false)
const orgForm = ref({
  divisionsText: '',
  sectionsText: '',
  rolesText: ''
})
const monitoringTotals = ref({
  offices: 0,
  activeOffices: 0,
  activeSpreadsheets: 0,
  attention: 0,
  personnel: 0,
  assessmentRecords: 0,
  completedAssignments: 0,
  pendingAssignments: 0
})

const form = ref(defaultForm())

onMounted(() => {
  loadOffices()
  loadMonitoring()
})

function defaultForm() {
  return {
    officeCode: '',
    officeName: '',
    officeShortName: '',
    primaryAdminEmail: ''
  }
}

async function loadOffices() {
  loading.value = true
  error.value = ''
  try {
    const data = await officeRegistryApi.list({ search: search.value, pageSize: 100 })
    offices.value = data.items || []
    total.value = data.total || offices.value.length
  } catch (e) {
    error.value = e?.message || 'Could not load the office registry.'
  } finally {
    loading.value = false
  }
}

function refreshAll() {
  loadOffices()
  loadMonitoring()
}

async function loadMonitoring() {
  monitoringLoading.value = true
  monitoringError.value = ''
  try {
    const data = await officeRegistryApi.monitoring({ search: search.value })
    monitoringItems.value = data.items || []
    monitoringTotals.value = {
      offices: 0,
      activeOffices: 0,
      activeSpreadsheets: 0,
      attention: 0,
      personnel: 0,
      assessmentRecords: 0,
      completedAssignments: 0,
      pendingAssignments: 0,
      ...(data.totals || {})
    }
  } catch (e) {
    monitoringError.value = e?.message || 'Could not load cluster monitoring data.'
  } finally {
    monitoringLoading.value = false
  }
}

function isStbOffice(office) {
  return String(office?.officeId || office?.officeCode || '').toUpperCase() === 'STB'
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
      divisionsText: divisions.map(item => item.code ? `${item.code} | ${item.name}` : item.name).join('\n'),
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
    closeOrgOptionsModal()
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
    if (result.validation?.valid) closeProvisionModal()
  } catch (e) {
    modalError.value = e?.message || 'Provisioning failed. Please try again.'
  } finally {
    saving.value = false
  }
}

async function validateOffice(office) {
  busyId.value = office.officeId
  error.value = ''
  try {
    await officeRegistryApi.validate(office.officeId)
    await loadOffices()
  } catch (e) {
    error.value = e?.message || 'Could not validate this office.'
  } finally {
    busyId.value = ''
  }
}

async function activateOffice(office) {
  busyId.value = office.officeId
  error.value = ''
  try {
    await officeRegistryApi.activate(office.officeId)
    await loadOffices()
  } catch (e) {
    error.value = e?.message || 'Could not activate this office.'
  } finally {
    busyId.value = ''
  }
}

function statusClass(status) {
  const value = String(status || '').toLowerCase()
  if (value.includes('active')) return 'good'
  if (value.includes('invalid') || value.includes('inaccessible')) return 'bad'
  if (value.includes('provision') || value.includes('validation') || value.includes('configuration')) return 'warn'
  return 'neutral'
}

function portalStatusLabel(status) {
  const value = String(status || '').toUpperCase()
  const labels = {
    ACTIVE: 'Active',
    FOR_VALIDATION: 'Ready to activate',
    NOT_PROVISIONED: 'Not created',
    PROVISIONING: 'Creating',
    INVALID_SCHEMA: 'Needs repair',
    INACCESSIBLE: 'Cannot access',
    SUSPENDED: 'Suspended',
    ARCHIVED: 'Archived'
  }
  return labels[value] || value || 'Not created'
}

function healthClass(health) {
  const value = String(health || '').toLowerCase()
  if (value === 'active') return 'good'
  if (value.includes('attention')) return 'bad'
  return 'warn'
}

function formatDate(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleDateString()
}
</script>

<style scoped>
.or-page{display:grid;gap:16px;color:#0f172a;}
.or-toolbar{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;background:#fff;border:1px solid #dbe4f0;border-radius:8px;padding:18px;}
.or-kicker{font-size:11px;font-weight:800;letter-spacing:.7px;text-transform:uppercase;color:#2563eb;margin:0 0 4px;}
h1,h2,p{margin:0;}
h1{font-size:22px;line-height:1.2;}
h2{font-size:15px;}
.or-sub,.or-panel-hd p,.or-modal-hd p{font-size:12px;color:#64748b;margin-top:4px;}
.or-panel,.or-monitor-panel{background:#fff;border:1px solid #dbe4f0;border-radius:8px;overflow:hidden;}
.or-panel-hd{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:14px 16px;border-bottom:1px solid #e5edf7;}
.or-stat-grid{display:grid;grid-template-columns:repeat(4,minmax(130px,1fr));gap:10px;padding:14px 16px;border-bottom:1px solid #eef2f7;background:#fbfdff;}
.or-stat{border:1px solid #e2e8f0;border-radius:8px;padding:11px 12px;background:#fff;display:flex;align-items:center;justify-content:space-between;gap:10px;}
.or-stat span{font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#64748b;font-weight:800;}
.or-stat strong{font-size:19px;color:#0b3b75;line-height:1;}
.or-search{display:flex;gap:8px;align-items:center;}
.or-search input,.or-form-grid input{height:36px;border:1px solid #dbe4f0;border-radius:8px;padding:0 10px;font:inherit;font-size:13px;}
.or-search input{width:260px;}
.or-btn{height:36px;border:1px solid #cbd5e1;background:#fff;border-radius:8px;padding:0 12px;font-weight:700;font-size:12px;cursor:pointer;color:#0f172a;}
.or-btn.primary{border-color:#0b3b75;background:#0b3b75;color:#fff;}
.or-btn:disabled,.or-icon-btn:disabled{opacity:.5;cursor:not-allowed;}
.or-empty,.or-error{padding:18px;text-align:center;color:#64748b;font-size:13px;}
.or-error{color:#b91c1c;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;margin:12px;text-align:left;}
.or-error.compact{margin:0;}
.or-table-wrap{overflow:auto;}
.or-table{width:100%;border-collapse:collapse;font-size:12px;}
.or-table th{height:34px;text-align:left;background:#f8fafc;color:#64748b;font-size:10px;text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid #e5edf7;padding:0 12px;}
.or-table td{border-bottom:1px solid #eef2f7;padding:11px 12px;vertical-align:middle;}
.or-table td strong{display:block;font-size:13px;color:#0f172a;}
.or-table td span{display:block;color:#64748b;margin-top:2px;}
.or-pill{display:inline-flex!important;align-items:center;border-radius:999px;padding:3px 8px;font-size:10px;font-weight:800;margin:0!important;}
.or-pill.good{background:#ecfdf5;color:#047857;}
.or-pill.warn{background:#fffbeb;color:#b45309;}
.or-pill.bad{background:#fef2f2;color:#b91c1c;}
.or-pill.neutral{background:#f1f5f9;color:#475569;}
.or-actions{display:flex;gap:6px;}
.or-icon-btn{border:1px solid #dbe4f0;background:#fff;border-radius:7px;height:30px;padding:0 9px;font-size:11px;font-weight:700;cursor:pointer;}
.or-readonly{font-size:11px;color:#64748b;font-weight:700;}
.or-monitor-table td{white-space:nowrap;}
.or-cell-note{display:block;color:#94a3b8;font-size:10.5px;margin-top:3px;line-height:1.25;white-space:normal;max-width:220px;}
.or-modal-overlay{position:fixed;inset:0;background:rgba(15,23,42,.42);display:grid;place-items:center;z-index:80;padding:20px;}
.or-modal{width:min(620px,100%);background:#fff;border-radius:10px;border:1px solid #dbe4f0;box-shadow:0 24px 80px rgba(15,23,42,.22);padding:18px;display:grid;gap:16px;}
.or-modal-wide{width:min(880px,100%);}
.or-modal-hd{display:flex;justify-content:space-between;gap:12px;}
.or-close{border:0;background:#f1f5f9;border-radius:8px;width:30px;height:30px;cursor:pointer;font-weight:800;}
.or-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
.or-form-grid label{display:grid;gap:6px;font-size:12px;font-weight:700;color:#334155;}
.or-form-grid .wide{grid-column:1 / -1;}
.or-config-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
.or-config-grid label{display:grid;gap:6px;font-size:12px;font-weight:700;color:#334155;}
.or-config-grid .wide{grid-column:1 / -1;}
.or-config-grid textarea{width:100%;resize:vertical;border:1px solid #dbe4f0;border-radius:8px;padding:10px;font:inherit;font-size:13px;line-height:1.4;}
.or-config-grid small{font-size:11px;line-height:1.35;color:#64748b;font-weight:600;}
.or-validation{border:1px solid #dbeafe;background:#eff6ff;color:#1e3a8a;border-radius:8px;padding:12px;font-size:12px;}
.or-validation ul{margin:8px 0 0;padding-left:18px;}
.or-modal-actions{display:flex;justify-content:flex-end;gap:8px;}
@media (max-width: 760px){.or-toolbar,.or-panel-hd{display:grid;}.or-search{display:grid;}.or-search input{width:100%;}.or-form-grid,.or-stat-grid{grid-template-columns:1fr;}}
</style>
