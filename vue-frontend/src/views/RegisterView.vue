<template>
  <div class="ob-root">
    <div class="ob-bg" aria-hidden="true"></div>
    <div class="ob-shell">
      <div class="ob-hero">
        <div class="ob-kicker">SOCIAL TECHNOLOGY BUREAU</div>
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
          Your Google account isn't set up in PMES yet. Fill in your details below — an administrator will review and activate your access.
        </div>

        <transition name="ob-fade">
          <div v-if="error" class="ob-error" role="alert">{{ error }}</div>
        </transition>

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
              <input v-model.trim="form.employeeNo" type="text" placeholder="e.g. 24-0247" :disabled="submitting"/>
            </div>
            <div class="ob-field ob-full">
              <label>Employment Type</label>
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
              <label>Division <span class="req">*</span></label>
              <select v-model="form.divisionId" :disabled="submitting || loadingOptions">
                <option value="">{{ loadingOptions ? 'Loading divisions…' : 'Select division…' }}</option>
                <option v-for="d in options.divisions" :key="d.id" :value="d.id">{{ d.name }}</option>
              </select>
            </div>
            <div class="ob-field">
              <label>Section</label>
              <input v-model.trim="form.section" type="text" placeholder="e.g. Children and Youth Section" :disabled="submitting"/>
            </div>
            <div class="ob-field">
              <label>Requested Role <span class="ob-hint">admin confirms</span></label>
              <select v-model="form.role" :disabled="submitting">
                <option value="">Select role…</option>
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
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { authApi } from '@/services/api'

const router = useRouter()
const authStore = useAuthStore()

const identity = computed(() => authStore.identity)
const initials = computed(() =>
  (identity.value.name || identity.value.email || '?').split(/[\s@.]+/).filter(Boolean).slice(0, 2).map(s => s[0]).join('').toUpperCase()
)

const options = ref({ divisions: [], employmentTypes: ['Regular'], requestedRoles: [] })
const loadingOptions = ref(true)
const submitting = ref(false)
const error = ref('')

const form = ref({
  firstName: '', middleName: '', lastName: '', suffix: '',
  position: '', employeeNo: '', type: 'Regular', divisionId: '', section: '', role: ''
})

// Full name on record: "First M.I. Last Suffix" — the middle name is shortened
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
watch(() => [form.value.firstName, form.value.middleName, form.value.lastName, form.value.suffix], () => {
  if (!fullNameTouched.value) fullName.value = composeName()
})
function onFullNameInput() { fullNameTouched.value = true }
function resetFullName() { fullNameTouched.value = false; fullName.value = composeName() }

const canSubmit = computed(() => form.value.firstName.trim() && form.value.lastName.trim() && fullName.value.trim() && form.value.divisionId)

// Prefill from the Google display name conservatively: last token is the
// surname, everything before it is the first name, and middle name is left
// blank (it can't be reliably guessed — e.g. "John Reiman" is a compound
// first name, not first + middle). The user corrects any of it.
function splitName(display) {
  const parts = String(display || '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length)      return { firstName: '', middleName: '', lastName: '' }
  if (parts.length === 1) return { firstName: parts[0], middleName: '', lastName: '' }
  return { firstName: parts.slice(0, -1).join(' '), middleName: '', lastName: parts[parts.length - 1] }
}

onMounted(async () => {
  const g = splitName(identity.value.name)
  form.value.firstName  = g.firstName
  form.value.middleName = g.middleName
  form.value.lastName   = g.lastName
  fullName.value        = composeName()
  try {
    const opts = await authApi.registerOptions()
    if (opts) {
      options.value = {
        divisions: opts.divisions || [],
        employmentTypes: opts.employmentTypes?.length ? opts.employmentTypes : ['Regular'],
        requestedRoles: opts.requestedRoles || []
      }
    }
  } catch { /* dropdowns fall back to defaults */ }
  finally { loadingOptions.value = false }
})

async function submit() {
  if (!canSubmit.value) { error.value = 'Please provide your first name, last name, and division.'; return }
  error.value = ''
  submitting.value = true
  try {
    const division = options.value.divisions.find(d => d.id === form.value.divisionId)
    await authStore.register({
      fullName:   fullName.value.trim(),
      firstName:  form.value.firstName,
      middleName: form.value.middleName,
      lastName:   form.value.lastName,
      suffix:     form.value.suffix,
      position:   form.value.position,
      employeeNo: form.value.employeeNo,
      type:       form.value.type,
      divisionId: form.value.divisionId,
      division:   division?.name || '',
      section:    form.value.section,
      role:       form.value.role
    })
    router.push('/auth/pending')
  } catch (e) {
    error.value = e.message || 'Could not submit registration. Please try again.'
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
.ob-kicker{font-size:10px;font-weight:800;letter-spacing:.24em;color:#8FB2E8;margin-bottom:7px;}
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
