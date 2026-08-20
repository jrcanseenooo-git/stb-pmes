<template>
  <div class="ob-root">
    <div class="ob-bg" aria-hidden="true"></div>
    <div class="ob-shell">
      <div class="ob-hero">
        <div class="ob-kicker">DSWD INNOVATION CLUSTER</div>
        <h1 class="ob-title">Performance Monitoring &amp; Evaluation System</h1>
      </div>

      <div class="ob-card">
        <div class="ob-card-hd">
          <div class="ob-avatar">{{ initials }}</div>
          <div class="ob-hd-info">
            <h2 class="ob-h2">Complete your registration</h2>
            <p class="ob-sub">Signed in as <strong>{{ identity.email }}</strong></p>
          </div>
        </div>

        <div class="ob-note">
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
            <circle cx="7.5" cy="7.5" r="6.3" stroke="#1D4ED8" stroke-width="1.3"/>
            <path d="M7.5 4.4v3.6M7.5 10v.1" stroke="#1D4ED8" stroke-width="1.4" stroke-linecap="round"/>
          </svg>
          Your Google account isn't set up in PMES yet. Fill in your details below - an administrator will review and activate your access.
        </div>

        <transition name="ob-fade">
          <div v-if="error" class="ob-error" role="alert">{{ error }}</div>
        </transition>

        <div v-if="checkingAccount" class="ob-note">
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
            <circle cx="7.5" cy="7.5" r="6.3" stroke="#1D4ED8" stroke-width="1.3"/>
            <path d="M7.5 4.4v3.6M7.5 10v.1" stroke="#1D4ED8" stroke-width="1.4" stroke-linecap="round"/>
          </svg>
          Checking your approved PMES account...
        </div>

        <form class="ob-form" @submit.prevent="submit" novalidate>
          <div class="ob-section-label">Profile details</div>

          <div class="ob-grid">
            <div class="ob-field">
              <label>First Name <span class="req">*</span></label>
              <input v-model.trim="form.firstName" type="text" placeholder="e.g. Juan" :disabled="submitting"/>
            </div>
            <div class="ob-field">
              <label>Middle Name <span class="ob-hint">optional</span></label>
              <input v-model.trim="form.middleName" type="text" placeholder="e.g. Santos" :disabled="submitting"/>
            </div>
            <div class="ob-field">
              <label>Last Name <span class="req">*</span></label>
              <input v-model.trim="form.lastName" type="text" placeholder="e.g. Dela Cruz" :disabled="submitting"/>
            </div>
            <div class="ob-field">
              <label>Suffix <span class="ob-hint">optional</span></label>
              <input v-model.trim="form.suffix" type="text" placeholder="e.g. Jr., III" :disabled="submitting"/>
            </div>
            <div class="ob-field">
              <label>Position / Title</label>
              <input v-model.trim="form.position" type="text" placeholder="e.g. Social Welfare Officer II" :disabled="submitting"/>
            </div>
            <div class="ob-field">
              <label>Employee No.</label>
              <input v-model.trim="form.employeeNo" type="text" placeholder="e.g. 24-0001" :disabled="submitting"/>
            </div>
            <div class="ob-field ob-full">
              <label>Employment Type <span class="req">*</span></label>
              <select v-model="form.type" :disabled="submitting">
                <option v-for="t in options.employmentTypes" :key="t" :value="t">{{ t }}</option>
              </select>
            </div>
          </div>

          <div class="ob-field ob-full" style="margin-top:12px">
            <label>
              Full Name on record <span class="ob-hint">auto-formatted · editable</span>
              <button v-if="fullNameTouched" type="button" class="ob-name-reset" @click="resetFullName">reset</button>
            </label>
            <input v-model="fullName" @input="onFullNameInput" type="text" placeholder="Full name as it should appear on records" :disabled="submitting"/>
            <span class="ob-name-tip">Middle name is shortened to an initial (e.g. Bautista → B.). Edit if the spelling or format needs to change.</span>
          </div>

          <div class="ob-section-label" style="margin-top:16px">Access &amp; assignment</div>

          <div class="ob-grid">
            <div class="ob-field ob-full">
              <label>Office / Program</label>
              <select v-model="form.officeId" :disabled="submitting">
                <option value="">Select office / program...</option>
                <option v-for="o in options.offices" :key="o.officeId" :value="o.officeId">
                  {{ o.officeName }}
                </option>
              </select>
              <span v-if="!isStbRegistration" class="ob-name-tip">
                This registration will be reviewed as a limited office portal account.
              </span>
            </div>
            <div class="ob-field ob-full">
              <label>
                Division <span class="ob-hint">{{ options.divisions.length ? 'optional' : 'admin confirms' }}</span>
                <button v-if="optionsError" type="button" class="ob-name-reset" @click="loadOptions" :disabled="loadingOptions">
                  {{ loadingOptions ? 'Retrying…' : 'Retry' }}
                </button>
              </label>
              <!-- Enabled for any office that has divisions configured, not just
                   STB. It stays disabled only while there is genuinely nothing
                   to choose from. -->
              <select v-model="form.divisionId"
                      :disabled="submitting || !form.officeId || !options.divisions.length">
                <option value="">{{ divisionPlaceholder }}</option>
                <option v-for="d in options.divisions" :key="d.id" :value="d.id">{{ d.name }}</option>
              </select>
              <span v-if="optionsError" class="ob-name-tip" style="color:#B45309">{{ optionsError }}</span>
              <span v-else-if="officeStructureMissing" class="ob-name-tip">
                {{ selectedOfficeName || 'This office' }} has not set up its divisions and sections yet.
                You can still submit - an administrator will assign them on approval.
              </span>
            </div>
            <div class="ob-field">
              <label>Section</label>
              <select v-model="form.section"
                      :disabled="submitting || !form.divisionId || !sectionsForDivision.length">
                <option value="">
                  {{ sectionPlaceholder }}
                </option>
                <option v-for="s in sectionsForDivision" :key="s.id" :value="s.name">{{ s.name }}</option>
              </select>
              <span v-if="!sectionsForDivision.length && form.divisionId && !loadingOptions"
                    class="ob-name-tip" style="color:#B45309">
                No sections are configured under this division. You can submit without one - an administrator will confirm it.
              </span>
            </div>
            <div class="ob-field">
              <label>Requested Role <span class="req">*</span> <span class="ob-hint">admin confirms</span></label>
              <!-- Roles are drawn from the selected office's own configuration,
                   so there is nothing meaningful to offer until an office is
                   chosen. -->
              <select v-model="form.role" :disabled="submitting || !form.officeId">
                <option value="">{{ rolePlaceholder }}</option>
                <option v-for="r in options.requestedRoles" :key="r" :value="r">{{ r }}</option>
              </select>
            </div>
          </div>

          <button type="submit" class="ob-submit" :disabled="submitting || !canSubmit">
            <span v-if="submitting" class="ob-spin"></span>
            {{ submitting ? 'Submitting…' : 'Submit for approval' }}
            <!-- <svg v-if="!submitting" width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M2.5 7.5h10M9 4l3.5 3.5L9 11" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg> -->
          </button>
        </form>

        <button class="ob-signout" @click="signOut" :disabled="submitting">Not you? Sign out</button>
      </div>
    </div>

    <transition name="ob-fade">
      <div v-if="showConfirmModal" class="ob-modal-overlay" @click.self="showConfirmModal = false">
        <div class="ob-modal">
          <div class="ob-modal-hd">
            <h3>Confirm registration details</h3>
            <p>System Admin will validate this information before approving your account.</p>
          </div>

          <div class="ob-confirm-list">
            <div class="ob-confirm-row">
              <span>Office / Program</span>
              <strong>{{ selectedOfficeName || 'No data' }}</strong>
            </div>
            <div class="ob-confirm-row">
              <span>Full Name</span>
              <strong>{{ fullName || 'No data' }}</strong>
            </div>
            <div class="ob-confirm-row">
              <span>Division</span>
              <strong :class="{ muted: !selectedDivisionName }">{{ selectedDivisionName || 'No data' }}</strong>
            </div>
            <div class="ob-confirm-row">
              <span>Section</span>
              <strong :class="{ muted: !form.section }">{{ form.section || 'No data' }}</strong>
            </div>
            <div class="ob-confirm-row">
              <span>Requested Role</span>
              <strong :class="{ muted: !form.role }">{{ form.role || 'No data' }}</strong>
            </div>
          </div>

          <div class="ob-modal-note">
            If access and assignment details are blank or uncertain, you can still submit. The System Admin will correct them in User Management before approval.
          </div>

          <div class="ob-modal-actions">
            <button type="button" class="ob-modal-cancel" :disabled="submitting" @click="showConfirmModal = false">Review Again</button>
            <button type="button" class="ob-modal-submit" :disabled="submitting" @click="submitConfirmed">
              <span v-if="submitting" class="ob-spin"></span>
              {{ submitting ? 'Submitting…' : 'Confirm & Submit' }}
            </button>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { authApi } from '@/services/api'
import { EMPLOYMENT_TYPES } from '@/utils/employmentTypes'

const router = useRouter()
const authStore = useAuthStore()

const identity = computed(() => authStore.identity)
const initials = computed(() =>
  (identity.value.name || identity.value.email || '?').split(/[\s@.]+/).filter(Boolean).map(s => s[0]).join('').toUpperCase()
)

// Static option lists live in the frontend so they always render even if the
// reference endpoint is unreachable. Only divisions must come from the server.
// EMPLOYMENT_TYPES is imported from utils/employmentTypes.js - see the import
// above. It is the fallback used only when the reference endpoint is
// unreachable; AuthService.gs serves the live list and the two must match.
const REQUESTED_ROLES  = ['Technical Staff', 'Section Head', 'Division Chief', 'Assistant Bureau Director', 'Bureau Director']
const FALLBACK_OFFICES = [
  {
    officeId: 'STB',
    officeCode: 'STB',
    officeName: 'Social Technology Bureau',
    officeShortName: 'STB',
    systemScope: 'STB_FULL'
  }
]
const FALLBACK_DIVISIONS = [
  { id: 'admin-pool', name: 'Admin Pool' },
  { id: 'dfd', name: 'Design Formulation Division' },
  { id: 'pid', name: 'Pilot Implementation Division' },
  { id: 'staed', name: 'Social Technology Analysis and Evaluation Division' }
]
const FALLBACK_SECTIONS = [
  { id: 'SEC-admin-office', divisionId: 'admin-pool', name: 'Office Admin Personnel' },
  { id: 'SEC-dfd-cy', divisionId: 'dfd', name: 'Children and Youth Section' },
  { id: 'SEC-dfd-omg', divisionId: 'dfd', name: 'Other Marginalized Groups Section' },
  { id: 'SEC-dfd-wpo', divisionId: 'dfd', name: 'Women, Persons with Disability and Older Persons Section' },
  { id: 'SEC-pid-cy', divisionId: 'pid', name: 'Children and Youth Section' },
  { id: 'SEC-pid-omg', divisionId: 'pid', name: 'Other Marginalized Groups Section' },
  { id: 'SEC-pid-wpo', divisionId: 'pid', name: 'Women, Persons with Disability and Older Persons Section' },
  { id: 'SEC-staed-ev', divisionId: 'staed', name: 'Social Technology Evaluation Section' },
  { id: 'SEC-staed-pm', divisionId: 'staed', name: 'Social Technology Portfolio Management Section' },
  { id: 'SEC-staed-pr', divisionId: 'staed', name: 'Social Technology Promotion Section' }
]

// The raw payload from the reference endpoint, kept whole so the office-scoped
// lists below can be recomputed whenever the registrant changes office.
const rawOptions = ref(null)

const officeList = computed(() => mergeOfficeOptions(rawOptions.value?.offices))

/**
 * Divisions, sections and roles belong to the OFFICE being registered into.
 *
 * The endpoint returns STB's lists at the top level and every participating
 * office's own lists under `officeOptions`, keyed by id and code. Reading only
 * the top level offered STB's divisions to every registrant regardless of the
 * office they picked, so the controls were disabled for non-STB offices and the
 * form fell back to "admin will confirm" for everyone else. Scope to the
 * selected office instead, and fall back to STB's own lists only for STB.
 */
const officeScopedOptions = computed(() => {
  const raw = rawOptions.value || {}
  const officeId = form.value.officeId
  if (!officeId) return { divisions: [], sections: [], requestedRoles: [] }

  if (isStbRegistration.value) {
    return {
      divisions: mergeDivisionOptions(raw.divisions),
      sections: mergeSectionOptions(raw.sections),
      requestedRoles: normalizeRoleOptions(raw.requestedRoles)
    }
  }

  const office = officeList.value.find(o => String(o.officeId) === String(officeId)) || null
  const byOffice = raw.officeOptions || {}
  const candidates = [officeId, office?.officeCode, office?.officeName]
    .filter(Boolean)
    .flatMap(key => [key, String(key).toUpperCase()])
  const scoped = candidates.map(key => byOffice[key]).find(Boolean) || null

  return {
    divisions: Array.isArray(scoped?.divisions) ? scoped.divisions : [],
    sections: Array.isArray(scoped?.sections) ? scoped.sections : [],
    requestedRoles: normalizeRoleOptions(scoped?.requestedRoles)
  }
})

const options = computed(() => ({
  offices: officeList.value,
  divisions: officeScopedOptions.value.divisions,
  sections: officeScopedOptions.value.sections,
  employmentTypes: rawOptions.value?.employmentTypes?.length
    ? rawOptions.value.employmentTypes
    : EMPLOYMENT_TYPES,
  requestedRoles: officeScopedOptions.value.requestedRoles
}))

// Sections belong to a division, so only offer the ones that fit the division
// the registrant chose. Before a division is picked the list is empty and the
// control shows "Choose a division first".
const sectionsForDivision = computed(() =>
  (options.value.sections || []).filter(s => String(s.divisionId) === String(form.value.divisionId))
)

// An office whose administrator has not yet configured its structure returns
// empty lists. Say so, rather than showing an empty dropdown that reads as a
// fault - registration is still allowed, and an admin assigns on approval.
const officeStructureMissing = computed(() =>
  !!form.value.officeId && !loadingOptions.value && !options.value.divisions.length
)

const divisionPlaceholder = computed(() => {
  if (!form.value.officeId) return 'Choose an office first'
  if (loadingOptions.value) return 'Loading…'
  if (!options.value.divisions.length) return 'Not yet configured - admin will assign'
  return 'Select division…'
})

const sectionPlaceholder = computed(() => {
  if (!form.value.officeId) return 'Choose an office first'
  if (!form.value.divisionId) return 'Choose a division first'
  if (!sectionsForDivision.value.length) return 'No sections configured'
  return 'Select section…'
})

const rolePlaceholder = computed(() =>
  form.value.officeId ? 'Select role…' : 'Choose an office first'
)
const loadingOptions = ref(false)
const optionsError = ref('')
const submitting = ref(false)
const error = ref('')
const checkingAccount = ref(false)
const showConfirmModal = ref(false)

const form = ref({
  firstName: '', middleName: '', lastName: '', suffix: '',
  position: '', employeeNo: '', type: 'Regular', officeId: '', divisionId: '', section: '', role: ''
})

// Reads officeList, NOT options.offices. `options` depends on
// officeScopedOptions, which depends on isStbRegistration, which depends on
// this - routing it back through `options` would close that loop into infinite
// recursion the moment an office is selected.
const selectedOffice = computed(() =>
  officeList.value.find(o => String(o.officeId) === String(form.value.officeId)) || null
)
const selectedOfficeName = computed(() =>
  selectedOffice.value?.officeName || ''
)
const isStbRegistration = computed(() =>
  String(selectedOffice.value?.officeId || form.value.officeId || '').toUpperCase() === 'STB'
)
const selectedDivisionName = computed(() =>
  options.value.divisions.find(d => d.id === form.value.divisionId)?.name || ''
)

// Full name on record: "First M.I. Last Suffix" - the middle name is shortened
// to an initial with a dot (PH government standard). Editable, so the user can
// validate the exact spelling; auto-composes from the parts until they edit it.
const fullName = ref('')
const fullNameTouched = ref(false)

function middleInitials(mid) {
  return String(mid || '').trim().split(/\s+/).filter(Boolean).map(w => w[0].toUpperCase() + '.').join(' ')
}
function composeName() {
  const core = [form.value.firstName, middleInitials(form.value.middleName), form.value.lastName]
    .map(s => String(s).trim()).filter(Boolean).join(' ')
  const sfx = form.value.suffix.trim()
  return sfx ? `${core}${core ? ' ' : ''}${sfx}` : core
}
// Changing division invalidates any section already chosen - a DFD section is
// not a valid PID section. Clear it rather than submit a mismatched pair, but
// keep a value that still exists under the new division.
watch(() => form.value.divisionId, () => {
  if (!form.value.section) return
  const stillValid = sectionsForDivision.value.some(s => s.name === form.value.section)
  if (!stillValid) form.value.section = ''
})

// Every one of these lists is office-specific, so a division, section or role
// chosen under the previous office is meaningless under the new one. Clearing
// only for non-STB left a stale STB division attached when switching back.
watch(() => form.value.officeId, () => {
  form.value.divisionId = ''
  form.value.section = ''
  form.value.role = ''
})

watch(() => [form.value.firstName, form.value.middleName, form.value.lastName, form.value.suffix], () => {
  if (!fullNameTouched.value) fullName.value = composeName()
})
function onFullNameInput() { fullNameTouched.value = true }
function resetFullName() { fullNameTouched.value = false; fullName.value = composeName() }

const canSubmit = computed(() =>
  form.value.firstName.trim() && form.value.lastName.trim() && fullName.value.trim() &&
  form.value.officeId && form.value.type && form.value.role
)

// Prefill from the Google display name conservatively: last token is the
// surname, everything before it is the first name, and middle name is left
// blank (it can't be reliably guessed - e.g. "John Reiman" is a compound
// first name, not first + middle). The user corrects any of it.
function splitName(display) {
  const parts = String(display || '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length)      return { firstName: '', middleName: '', lastName: '' }
  if (parts.length === 1) return { firstName: parts[0], middleName: '', lastName: '' }
  return { firstName: parts.slice(0, -1).join(' '), middleName: '', lastName: parts[parts.length - 1] }
}

async function loadOptions() {
  loadingOptions.value = true
  optionsError.value = ''
  try {
    // Store the payload whole. The office-scoped lists are derived from it, so
    // picking a different office re-derives them without another round trip.
    rawOptions.value = await authApi.registerOptions()
  } catch (e) {
    rawOptions.value = null
    optionsError.value = `Could not load office options (${e.message || 'network error'}). Retry, or submit and an admin will assign your division and section.`
  } finally {
    loadingOptions.value = false
  }
}

function mergeSectionOptions(sections = []) {
  const merged = [...FALLBACK_SECTIONS, ...(Array.isArray(sections) ? sections : [])]
  const seen = new Set()
  return merged.filter(section => {
    const key = `${section.divisionId || ''}:${section.name || ''}`.toLowerCase()
    if (!section.divisionId || !section.name || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function mergeOfficeOptions(offices = []) {
  const merged = [...FALLBACK_OFFICES, ...(Array.isArray(offices) ? offices : [])]
  const seen = new Set()
  return merged.filter(office => {
    const key = String(office.officeId || office.officeCode || '').toUpperCase()
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  }).sort((a, b) => String(a.officeName || '').localeCompare(String(b.officeName || '')))
}

function mergeDivisionOptions(divisions = []) {
  const merged = [...FALLBACK_DIVISIONS, ...(Array.isArray(divisions) ? divisions : [])]
  const seen = new Set()
  return merged.filter(division => {
    const key = String(division.id || division.name || '').toLowerCase()
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function normalizeRoleOptions(roles = []) {
  const source = Array.isArray(roles) && roles.length ? roles : REQUESTED_ROLES
  return source.map(role => role === 'Staff' ? 'Technical Staff' : role)
}

async function recoverExistingAccount() {
  checkingAccount.value = true
  try {
    await authStore.fetchProfile()
    if (authStore.hasAccess) {
      router.replace('/evaluation')
      return true
    }
    if (authStore.needsActivation) {
      router.replace('/auth/pending')
      return true
    }
  } finally {
    checkingAccount.value = false
  }
  return false
}

onMounted(async () => {
  const g = splitName(identity.value.name)
  form.value.firstName  = g.firstName
  form.value.middleName = g.middleName
  form.value.lastName   = g.lastName
  fullName.value        = composeName()
  loadOptions()
  if (!authStore.needsRegistration) recoverExistingAccount()
})

async function submit() {
  if (!form.value.firstName.trim() || !form.value.lastName.trim() || !fullName.value.trim()) {
    error.value = 'Please provide your first name and last name.'
    return
  }
  if (!form.value.officeId) {
    error.value = 'Please select your office or program.'
    return
  }
  if (!form.value.type) {
    error.value = 'Please select your employment type.'
    return
  }
  if (!form.value.role) {
    error.value = 'Please select your requested role.'
    return
  }
  error.value = ''
  showConfirmModal.value = true
}

async function submitConfirmed() {
  error.value = ''
  submitting.value = true
  try {
    await authStore.register({
      fullName:   fullName.value.trim(),
      firstName:  form.value.firstName,
      middleName: form.value.middleName,
      lastName:   form.value.lastName,
      suffix:     form.value.suffix,
      position:   form.value.position,
      employeeNo: form.value.employeeNo,
      type:       form.value.type,
      officeId:   selectedOffice.value.officeId,
      divisionId: form.value.divisionId,
      division:   selectedDivisionName.value,
      section:    form.value.section,
      role:       form.value.role
    })
    showConfirmModal.value = false
    router.push('/auth/pending')
  } catch (e) {
    if (e?.status === 409 || String(e?.message || '').toLowerCase().includes('account for this email already exists')) {
      await authStore.fetchProfile()
      if (authStore.hasAccess) {
        router.replace('/evaluation')
        return
      }
      if (authStore.needsActivation) {
        router.replace('/auth/pending')
        return
      }
    }
    error.value = 'Could not submit registration. Please check your details and try again.'
  } finally {
    submitting.value = false
  }
}

async function signOut() {
  await authStore.logout()
  router.push('/auth/login')
}
</script>

<style scoped>
*{box-sizing:border-box;}
.ob-root{position:fixed;inset:0;overflow-y:auto;display:flex;align-items:flex-start;justify-content:center;padding:40px 16px;}
.ob-bg{position:fixed;inset:0;z-index:0;background:#0A1526;
  background-image:radial-gradient(1200px 600px at 20% -10%,#12315F 0%,transparent 55%),radial-gradient(900px 500px at 110% 10%,#2A1A46 0%,transparent 50%),linear-gradient(160deg,#0C1E3C,#0A1220 60%,#140C26);}
.ob-shell{position:relative;z-index:1;width:100%;max-width:600px;}

.ob-hero{text-align:center;margin-bottom:18px;}
.ob-kicker{max-width:min(92vw,720px);margin:0 auto 7px;font-size:10px;font-weight:800;line-height:1.35;letter-spacing:.08em;color:#8FB2E8;}
.ob-title{font-size:16px;font-weight:800;color:#EAF1FB;letter-spacing:-.2px;margin:0;}

.ob-card{background:#fff;border-radius:18px;padding:24px;box-shadow:0 30px 80px rgba(2,8,24,.55);}
.ob-card-hd{display:flex;align-items:center;gap:13px;margin-bottom:16px;}
.ob-avatar{width:46px;height:46px;border-radius:13px;background:linear-gradient(135deg,#2F6BE4,#1A56B0);color:#fff;display:flex;align-items:center;justify-content:center;font-size:17px;font-weight:800;flex-shrink:0;}
.ob-h2{font-size:19px;font-weight:800;color:#0F172A;margin:0;letter-spacing:-.3px;}
.ob-sub{font-size:12.5px;color:#64748B;margin:2px 0 0;}
.ob-sub strong{color:#334155;}

.ob-note{display:flex;gap:9px;align-items:flex-start;background:#EFF5FF;border:1px solid #D5E4FB;border-radius:11px;padding:11px 13px;font-size:12.5px;color:#1E40AF;line-height:1.55;margin-bottom:16px;}
.ob-note svg{flex-shrink:0;margin-top:1px;}
.ob-error{background:#FEF2F2;border:1px solid #FECACA;color:#B91C1C;border-radius:10px;padding:10px 13px;font-size:12.5px;margin-bottom:14px;}

.ob-section-label{font-size:10.5px;font-weight:800;letter-spacing:.09em;color:#94A3B8;text-transform:uppercase;margin-bottom:10px;}
.ob-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
.ob-field{display:flex;flex-direction:column;gap:5px;min-width:0;}
.ob-full{grid-column:1 / -1;}
.ob-field label{font-size:11.5px;font-weight:700;color:#374151;display:flex;align-items:center;gap:6px;}
.req{color:#EF4444;}
.ob-hint{font-size:9.5px;font-weight:600;color:#B7C3D4;text-transform:none;letter-spacing:0;}
.ob-field input,.ob-field select{width:100%;padding:10px 12px;border:1.5px solid #E2E8F0;border-radius:10px;font-size:13px;color:#0F172A;background:#fff;outline:none;transition:border-color .15s,box-shadow .15s;}
.ob-field input:focus,.ob-field select:focus{border-color:#3B82F6;box-shadow:0 0 0 3px rgba(59,130,246,.12);}
.ob-field input::placeholder{color:#CBD5E1;}

.ob-name-reset{margin-left:auto;background:none;border:none;color:#3B82F6;font-size:11px;font-weight:600;cursor:pointer;padding:0;}
.ob-name-reset:hover{text-decoration:underline;}
.ob-name-tip{font-size:10.5px;color:#94A3B8;line-height:1.4;}

.ob-modal-overlay{position:fixed;inset:0;z-index:20;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(3,10,24,.58);backdrop-filter:blur(4px);}
.ob-modal{width:100%;max-width:440px;background:#fff;border-radius:16px;box-shadow:0 24px 80px rgba(2,8,24,.42);overflow:hidden;border:1px solid #E2E8F0;}
.ob-modal-hd{padding:20px 22px 14px;border-bottom:1px solid #EEF2F7;background:#FAFCFF;}
.ob-modal-hd h3{margin:0 0 4px;color:#0F172A;font-size:17px;font-weight:800;letter-spacing:-.2px;}
.ob-modal-hd p{margin:0;color:#64748B;font-size:12.5px;line-height:1.45;}
.ob-confirm-list{padding:14px 22px 2px;}
.ob-confirm-row{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;padding:10px 0;border-bottom:1px solid #F1F5F9;}
.ob-confirm-row span{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:#94A3B8;}
.ob-confirm-row strong{font-size:13px;color:#0F172A;text-align:right;line-height:1.35;}
.ob-confirm-row strong.muted{color:#B45309;}
.ob-modal-note{margin:14px 22px 0;border:1px solid #FDE68A;background:#FFFBEB;color:#92400E;border-radius:10px;padding:10px 12px;font-size:12px;line-height:1.45;}
.ob-modal-actions{display:flex;justify-content:flex-end;gap:8px;padding:16px 22px 20px;}
.ob-modal-cancel,.ob-modal-submit{border-radius:10px;padding:10px 14px;font-size:12.5px;font-weight:800;cursor:pointer;border:1px solid #DDE7F3;}
.ob-modal-cancel{background:#fff;color:#475569;}
.ob-modal-cancel:hover:not(:disabled){background:#F8FAFC;}
.ob-modal-submit{display:inline-flex;align-items:center;justify-content:center;gap:7px;background:#1D4ED8;border-color:#1D4ED8;color:#fff;min-width:138px;}
.ob-modal-submit:hover:not(:disabled){background:#1E40AF;border-color:#1E40AF;}
.ob-modal-cancel:disabled,.ob-modal-submit:disabled{opacity:.6;cursor:not-allowed;}

.ob-submit{width:100%;margin-top:20px;display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:12px;border:none;border-radius:11px;background:linear-gradient(135deg,#2F6BE4,#1A56B0);color:#fff;font-size:14px;font-weight:700;cursor:pointer;transition:filter .15s,box-shadow .15s;box-shadow:0 8px 20px rgba(26,86,176,.32);}
.ob-submit:hover:not(:disabled){filter:brightness(1.06);box-shadow:0 10px 26px rgba(26,86,176,.42);}
.ob-submit:disabled{opacity:.55;cursor:not-allowed;box-shadow:none;}
.ob-signout{display:block;margin:14px auto 0;background:none;border:none;color:#94A3B8;font-size:12px;cursor:pointer;}
.ob-signout:hover{color:#475569;text-decoration:underline;}

.ob-spin{width:15px;height:15px;border:2px solid rgba(255,255,255,.35);border-top-color:#fff;border-radius:50%;animation:ob-spin .6s linear infinite;}
@keyframes ob-spin{to{transform:rotate(360deg)}}
.ob-fade-enter-active,.ob-fade-leave-active{transition:opacity .2s;}
.ob-fade-enter-from,.ob-fade-leave-to{opacity:0;}

@media(max-width:560px){.ob-grid{grid-template-columns:1fr;}.ob-card{padding:18px;}}
</style>
