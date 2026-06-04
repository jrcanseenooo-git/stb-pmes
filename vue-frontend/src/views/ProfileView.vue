<template>
  <div class="content">

    <!-- ── Profile Header ── -->
    <div class="profile-header">
      <div class="avatar-wrap">
        <div class="avatar">{{ initials }}</div>
        <div class="avatar-badge">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M2 5l2 2 4-4" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
      </div>
      <div class="profile-info">
        <div class="profile-name">{{ fullName }}</div>
        <div class="profile-role">{{ position !== '—' ? position : role }}</div>
        <div class="profile-email">{{ userEmail }}</div>
        <div class="profile-tags">
          <span class="tag" style="background:#EBF4FF;color:#2F80ED">{{ role }}</span>
          <span class="tag" :style="isActive ? 'background:#E6F4EA;color:#27AE60' : 'background:#FEF2F2;color:#EB5757'">
            {{ isActive ? 'Active' : 'Inactive' }}
          </span>
          <span v-if="divisionName !== '—'" class="tag" style="background:#F5F3FF;color:#7C3AED">
            {{ divisionName }}
          </span>
        </div>
      </div>
      <button class="btn btn-primary edit-btn" @click="toggleEdit">
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
          <path d="M1 10.5L8 3.5l1.5 1.5L2.5 12H1V10.5z" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M7 4.5l1.5-1.5 1.5 1.5L8.5 6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
        </svg>
        {{ editMode ? 'Cancel' : 'Edit Profile' }}
      </button>
    </div>

    <div class="grid-3-1">

      <!-- Left col -->
      <div class="left-col">

        <!-- ── Personal Information ── -->
        <div class="card mb-10">
          <div class="card-hd">
            <span class="card-title">Personal Information</span>
            <span v-if="saveSuccess" class="saved-tag">✓ Saved</span>
          </div>
          <div class="card-body">

            <!-- Loading state -->
            <div v-if="profileLoading" class="loading-row">
              <div class="skeleton" style="width:60%;height:14px"></div>
              <div class="skeleton" style="width:40%;height:14px"></div>
              <div class="skeleton" style="width:70%;height:14px"></div>
              <div class="skeleton" style="width:50%;height:14px"></div>
            </div>

            <div v-else class="info-grid">
              <!-- Full Name -->
              <div class="info-item">
                <label class="info-label">First Name</label>
                <div v-if="!editMode" class="info-val">{{ form.firstName || '—' }}</div>
                <input v-else v-model="form.firstName" class="field-input" placeholder="First name"/>
              </div>
              <div class="info-item">
                <label class="info-label">Last Name</label>
                <div v-if="!editMode" class="info-val">{{ form.lastName || '—' }}</div>
                <input v-else v-model="form.lastName" class="field-input" placeholder="Last name"/>
              </div>

              <!-- Employee No. -->
              <div class="info-item">
                <label class="info-label">Employee No.</label>
                <div v-if="!editMode" class="info-val">{{ form.employeeNo || '—' }}</div>
                <input v-else v-model="form.employeeNo" class="field-input" placeholder="e.g. DSWD-2024-0001"/>
              </div>

              <!-- Email -->
              <div class="info-item">
                <label class="info-label">Email Address</label>
                <div class="info-val">{{ userEmail }}</div>
              </div>

              <!-- Position -->
              <div class="info-item">
                <label class="info-label">Position / Title</label>
                <div v-if="!editMode" class="info-val">{{ form.position || '—' }}</div>
                <input v-else v-model="form.position" class="field-input" placeholder="e.g. Social Welfare Officer II"/>
              </div>

              <!-- Division -->
              <div class="info-item">
                <label class="info-label">Division</label>
                <div class="info-val">{{ divisionName }}</div>
              </div>

              <!-- Employment Type -->
              <div class="info-item">
                <label class="info-label">Employment Type</label>
                <div v-if="!editMode" class="info-val">{{ form.employmentType || '—' }}</div>
                <select v-else v-model="form.employmentType" class="field-input">
                  <option>Regular</option>
                  <option>Contract of Service (COS)</option>
                  <option>Co-Term</option>
                </select>
              </div>

              <!-- Role (read-only always) -->
              <div class="info-item">
                <label class="info-label">Role</label>
                <div class="info-val">{{ role }}</div>
              </div>
            </div>

            <div v-if="editMode && !profileLoading" class="save-row">
              <button class="btn btn-primary" :disabled="saving" @click="saveProfile">
                <span v-if="saving" class="spinner-sm"></span>
                {{ saving ? 'Saving…' : 'Save Changes' }}
              </button>
              <button class="btn" @click="editMode = false">Cancel</button>
            </div>

            <div v-if="saveError" class="save-error">{{ saveError }}</div>
          </div>
        </div>

        <!-- ── Performance Summary ── -->
        <div class="card mb-10">
          <div class="card-hd">
            <span class="card-title">Performance Summary</span>
            <span class="sem-tag">{{ currentPeriodLabel }}</span>
          </div>
          <div class="card-body">
            <div v-if="statsLoading" class="perf-grid">
              <div v-for="i in 4" :key="i" class="perf-item">
                <div class="skeleton" style="width:50px;height:28px;margin:auto 0 4px"></div>
                <div class="skeleton" style="width:60px;height:11px"></div>
              </div>
            </div>
            <div v-else class="perf-grid">
              <div v-for="p in perfStats" :key="p.label" class="perf-item" :style="{ borderTop: '2px solid ' + p.color }">
                <div class="perf-val" :style="{ color: p.color }">{{ p.value }}</div>
                <div class="perf-label">{{ p.label }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- ── Recent Activity ── -->
        <div class="card">
          <div class="card-hd">
            <span class="card-title">Recent Activity</span>
          </div>
          <div class="card-body pd-0">
            <div v-if="activityLoading" class="activity-row" v-for="i in 4" :key="i">
              <div class="skeleton-dot"></div>
              <div style="flex:1">
                <div class="skeleton" style="width:80%;height:12px;margin-bottom:4px"></div>
                <div class="skeleton" style="width:40%;height:10px"></div>
              </div>
            </div>
            <div v-else-if="activity.length === 0" class="empty-activity">No recent activity.</div>
            <div v-else v-for="a in activity" :key="a.id" class="activity-row">
              <div class="activity-dot" :style="{ background: activityColor(a.action) }"></div>
              <div class="activity-body">
                <div class="activity-msg">{{ a.details || a.action }}</div>
                <div class="activity-time">{{ formatDateTime(a.timestamp) }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Right col -->
      <div class="right-col">

        <!-- ── Account Settings ── -->
        <div class="card mb-10">
          <div class="card-hd"><span class="card-title">Account Settings</span></div>
          <div class="card-body">
            <div class="setting-list">
              <div v-for="s in settings" :key="s.label" class="setting-item">
                <div class="setting-icon" :style="{ background: s.iconBg, color: s.iconColor }">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path :d="s.icon" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </div>
                <div class="setting-info">
                  <div class="setting-label">{{ s.label }}</div>
                  <div class="setting-sub">{{ s.sub }}</div>
                </div>
                <button class="setting-action" @click="handleSetting(s.label)">{{ s.action }}</button>
              </div>
            </div>
          </div>
        </div>

        <!-- ── Current Period ── -->
        <div class="card mb-10">
          <div class="card-hd"><span class="card-title">Current Period</span></div>
          <div class="card-body">
            <div class="period-row">
              <div class="period-dot"></div>
              <div>
                <div class="period-label">{{ currentPeriodLabel }}</div>
                <div class="period-dates">{{ currentPeriodDates }}</div>
              </div>
            </div>
            <div class="progress-bar-wrap">
              <div class="progress-bar" :style="{ width: semesterProgress + '%' }"></div>
            </div>
            <div class="progress-labels">
              <span>{{ semesterProgress }}% of semester complete</span>
              <span>{{ daysLeft }} days left</span>
            </div>
          </div>
        </div>

        <!-- ── Quick Actions ── -->
        <div class="card">
          <div class="card-hd"><span class="card-title">Quick Actions</span></div>
          <div class="card-body pd-0">
            <div class="quick-actions">
              <button class="quick-btn" @click="$router.push('/accomplishments')">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1.5" y="1.5" width="13" height="13" rx="2" stroke="#2F80ED" stroke-width="1.4"/><path d="M5 8l2 2 4-4" stroke="#2F80ED" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
                View Accomplishments
              </button>
              <button class="quick-btn" @click="$router.push('/mov')">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 2h7l3 3v9a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1z" stroke="#27AE60" stroke-width="1.4"/><path d="M10 2v3h3" stroke="#27AE60" stroke-width="1.4" stroke-linecap="round"/></svg>
                Upload MOV
              </button>
              <button class="quick-btn" @click="$router.push('/evaluation')">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1.5l1.8 3.6 3.7.5-2.75 2.7.65 3.8L8 10.3l-3.4 1.8.65-3.8L2.5 5.6l3.7-.5L8 1.5z" stroke="#E9A840" stroke-width="1.4" stroke-linejoin="round"/></svg>
                View Ratings
              </button>
              <button class="quick-btn" @click="$router.push('/kra')">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1.5" y="3.5" width="13" height="2" rx="1" fill="#7C3AED"/><rect x="1.5" y="7.5" width="9" height="2" rx="1" fill="#7C3AED"/><rect x="1.5" y="11.5" width="11" height="2" rx="1" fill="#7C3AED"/></svg>
                My IPCRF
              </button>
              <button class="quick-btn logout" @click="handleLogout">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 1H3a1 1 0 00-1 1v12a1 1 0 001 1h3" stroke="#EB5757" stroke-width="1.4" stroke-linecap="round"/><path d="M11 11l4-4-4-4M15 7H6" stroke="#EB5757" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
                Sign Out
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { usersApi, dashboardApi, auditApi } from '@/services/api'

const authStore = useAuthStore()
const router    = useRouter()

// ── State ──
const editMode      = ref(false)
const saving        = ref(false)
const saveSuccess   = ref(false)
const saveError     = ref('')
const profileLoading = ref(false)
const statsLoading  = ref(false)
const activityLoading = ref(false)
const activity      = ref([])

// ── Computed from store ──
const fullName    = computed(() => authStore.fullName)
const role        = computed(() => authStore.role || 'Staff')
const userEmail   = computed(() => authStore.user?.email || '—')
const initials    = computed(() => authStore.initials)
const divisionName = computed(() => authStore.divisionName)
const isActive    = computed(() => authStore.isActive)
const position    = computed(() => authStore.position)

// ── Editable form (mirrors DB fields) ──
const form = ref({
  firstName:      '',
  lastName:       '',
  employeeNo:     '',
  position:       '',
  employmentType: '',
  createdAt:      ''
})

// ── Performance stats (live from dashboard API) ──
const perfStats = ref([
  { label: 'Targets',   value: '—', color: '#2F80ED' },
  { label: 'Completed', value: '—', color: '#27AE60' },
  { label: 'Pending',   value: '—', color: '#E9A840' },
  { label: 'Rating',    value: '—', color: '#27AE60' }
])

// ── Semester period ──
const now = new Date()
const isS1 = now.getMonth() < 6
const currentPeriodLabel = computed(() => isS1 ? 'Semester 1, ' + now.getFullYear() : 'Semester 2, ' + now.getFullYear())
const currentPeriodDates = computed(() => isS1
  ? `Jan 1 – Jun 30, ${now.getFullYear()}`
  : `Jul 1 – Dec 31, ${now.getFullYear()}`
)
const semesterEnd  = new Date(isS1 ? `${now.getFullYear()}-06-30` : `${now.getFullYear()}-12-31`)
const semesterStart = new Date(isS1 ? `${now.getFullYear()}-01-01` : `${now.getFullYear()}-07-01`)
const semesterProgress = computed(() => {
  const total = semesterEnd - semesterStart
  const elapsed = Math.min(now - semesterStart, total)
  return Math.max(0, Math.round((elapsed / total) * 100))
})
const daysLeft = computed(() => {
  const diff = semesterEnd - now
  return Math.max(0, Math.ceil(diff / 86400000))
})

// ── Account settings ──
const settings = [
  { label:'Change Password',     sub:'Last changed 3 months ago',         action:'Change',  icon:'M1 7s2-5 6-5 6 5 6 5-2 5-6 5-6-5-6-5zM8 7a2 2 0 01-2 2 2 2 0 01-2-2 2 2 0 012-2 2 2 0 012 2z', iconBg:'#EBF4FF', iconColor:'#2F80ED' },
  { label:'Email Notifications', sub:'Receive deadline & approval alerts', action:'Manage',  icon:'M1 4a1 1 0 011-1h10a1 1 0 011 1v6a1 1 0 01-1 1H2a1 1 0 01-1-1V4zM1 5l6 4 6-4', iconBg:'#E6F4EA', iconColor:'#27AE60' },
  { label:'Two-Factor Auth',     sub:'Not yet enabled',                    action:'Enable',  icon:'M7 1L1 3.5v4c0 3 2.5 5 6 5.5 3.5-.5 6-2.5 6-5.5v-4L7 1z', iconBg:'#FEF3E2', iconColor:'#C8882A' }
]

// ── Lifecycle ──
onMounted(async () => {
  // Retry fetchProfile if the store only has fallback data (no employeeNo = API failed at login)
  if (!authStore.employeeNo || authStore.employeeNo === '—') {
    try { await authStore.fetchProfile() } catch (e) { console.warn("[Profile] fetchProfile retry:", e.message) }
  }
  populateForm()
  await Promise.all([fetchPerfStats(), fetchActivity()])
})

// Re-populate form whenever profile updates (fetchProfile may complete after mount)
watch(() => authStore.profile, () => { populateForm() }, { deep: true })

function populateForm() {
  form.value = {
    firstName:      authStore.firstName      || '',
    lastName:       authStore.lastName       || '',
    employeeNo:     authStore.employeeNo     !== '—' ? authStore.employeeNo  : '',
    position:       authStore.position       !== '—' ? authStore.position    : '',
    employmentType: authStore.employmentType || 'Regular',
    createdAt:      authStore.createdAt      || ''
  }
}

async function fetchPerfStats() {
  statsLoading.value = true
  try {
    const semester = isS1 ? 'S1' : 'S2'
    const summary  = await dashboardApi.summary({ semester, year: now.getFullYear() })
    perfStats.value = [
      { label: 'Targets',   value: String(summary.totalTargets  ?? '—'), color: '#2F80ED' },
      { label: 'Completed', value: String(summary.completed     ?? '—'), color: '#27AE60' },
      { label: 'Pending',   value: String(summary.pending       ?? '—'), color: '#E9A840' },
      { label: 'Rating',    value: '—',                                   color: '#27AE60' }
    ]
    // Try fetching the user's evaluation rating
    try {
      const { authApi, evaluationApi } = await import('@/services/api')
      const evals = await evaluationApi.list({ userId: authStore.profileId, semester, year: now.getFullYear() })
      const myEval = (evals?.items ?? evals ?? []).find(e => e.userId === authStore.profileId)
      if (myEval?.overall) {
        perfStats.value[3].value = String(myEval.overall)
      }
    } catch { /* rating optional */ }
  } catch (e) {
    console.warn('[Profile] Could not load stats:', e.message)
  } finally {
    statsLoading.value = false
  }
}

async function fetchActivity() {
  activityLoading.value = true
  try {
    const result = await auditApi.list({
      userId:   authStore.profileId,
      pageSize: 8
    })
    activity.value = result?.items ?? []
  } catch (e) {
    console.warn('[Profile] Could not load activity:', e.message)
    activity.value = []
  } finally {
    activityLoading.value = false
  }
}

// ── Edit / Save ──
function toggleEdit() {
  if (editMode.value) {
    editMode.value = false
    populateForm()
  } else {
    editMode.value = true
  }
}

async function saveProfile() {
  saving.value   = true
  saveError.value = ''
  try {
    const fullName = `${form.value.firstName} ${form.value.lastName}`.trim()
    const updated  = await usersApi.update(authStore.profileId, {
      firstName:  form.value.firstName,
      lastName:   form.value.lastName,
      fullName,
      position:   form.value.position,
      employeeNo: form.value.employeeNo,
      type:       form.value.employmentType
    })
    // Patch the local store so UI updates immediately
    authStore.patchProfile({
      firstName:  form.value.firstName,
      lastName:   form.value.lastName,
      fullName,
      position:   form.value.position,
      employeeNo: form.value.employeeNo,
      type:       form.value.employmentType
    })
    editMode.value  = false
    saveSuccess.value = true
    setTimeout(() => { saveSuccess.value = false }, 3000)
  } catch (e) {
    saveError.value = e.message || 'Failed to save. Please try again.'
  } finally {
    saving.value = false
  }
}

// ── Logout ──
async function handleLogout() {
  await authStore.logout()
  router.push('/auth/login')
}

// ── Helpers ──
function formatDate(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
  } catch { return '—' }
}

function formatDateTime(iso) {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) +
           ' · ' + d.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })
  } catch { return '' }
}

function activityColor(action) {
  if (!action) return '#94A3B8'
  const a = action.toUpperCase()
  if (a.includes('LOGIN'))   return '#718096'
  if (a.includes('SUBMIT'))  return '#2F80ED'
  if (a.includes('APPROVE')) return '#27AE60'
  if (a.includes('RETURN') || a.includes('REVISION')) return '#E9A840'
  if (a.includes('CREATE') || a.includes('ADD'))      return '#27AE60'
  if (a.includes('DELETE'))  return '#EB5757'
  if (a.includes('UPDATE'))  return '#7C3AED'
  return '#94A3B8'
}

function handleSetting(label) {
  if (label === 'Sign Out') handleLogout()
  // TODO: wire Change Password, Email Notifications, Two-Factor Auth modals
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap');
*{box-sizing:border-box;}
.content{padding:20px 24px 24px;font-family:'DM Sans',sans-serif;font-size:13px;color:#1A2332;background:#EEF2F7;min-height:100%;}

/* Profile header */
.profile-header{display:flex;align-items:center;gap:20px;background:#fff;border:1px solid #E2E8F0;border-radius:14px;padding:20px 24px;margin-bottom:16px;box-shadow:0 1px 3px rgba(0,0,0,.04);}
.avatar-wrap{position:relative;flex-shrink:0;}
.avatar{width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,#2F80ED,#1a6cd4);display:flex;align-items:center;justify-content:center;color:#fff;font-size:22px;font-weight:700;}
.avatar-badge{position:absolute;bottom:0;right:0;width:18px;height:18px;background:#27AE60;border-radius:50%;border:2px solid #fff;display:flex;align-items:center;justify-content:center;}
.profile-info{flex:1;}
.profile-name{font-size:18px;font-weight:700;color:#0F172A;letter-spacing:-.3px;margin-bottom:2px;}
.profile-role{font-size:13px;color:#64748B;margin-bottom:2px;}
.profile-email{font-size:12px;color:#94A3B8;margin-bottom:8px;}
.profile-tags{display:flex;gap:6px;flex-wrap:wrap;}
.tag{padding:2px 8px;border-radius:20px;font-size:10px;font-weight:500;}
.edit-btn{display:flex;align-items:center;gap:6px;flex-shrink:0;}

/* Grid */
.grid-3-1{display:grid;grid-template-columns:1fr 280px;gap:16px;align-items:start;}
@media(max-width:900px){.grid-3-1{grid-template-columns:1fr;}}
.left-col,.right-col{display:flex;flex-direction:column;gap:0;}
.mb-10{margin-bottom:12px;}

/* Card */
.card{background:#fff;border:1px solid #E2E8F0;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,.04);}
.card-hd{display:flex;align-items:center;justify-content:space-between;padding:14px 18px 0;}
.card-title{font-size:12px;font-weight:600;color:#64748B;text-transform:uppercase;letter-spacing:.5px;}
.card-body{padding:14px 18px 18px;}
.pd-0 .activity-row{padding:10px 18px;}
.pd-0{padding:0 !important;}
.saved-tag{font-size:11px;color:#27AE60;font-weight:500;}
.sem-tag{font-size:11px;color:#64748B;background:#F1F5F9;padding:2px 8px;border-radius:6px;}

/* Info grid */
.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px 20px;}
@media(max-width:600px){.info-grid{grid-template-columns:1fr;}}
.info-item{display:flex;flex-direction:column;justify-content:flex-start;min-height:40px;}
.info-label{font-size:10px;font-weight:600;color:#94A3B8;text-transform:uppercase;letter-spacing:.4px;display:block;margin-bottom:3px;}
.info-val{font-size:13px;color:#0F172A;font-weight:500;line-height:1.5;word-break:break-word;}
.field-input{width:100%;padding:6px 10px;border:1px solid #E2E8F0;border-radius:7px;font-size:13px;color:#0F172A;font-family:inherit;background:#F8FAFC;outline:none;transition:border-color .15s;}
.field-input:focus{border-color:#2F80ED;background:#fff;}
.save-row{display:flex;gap:8px;margin-top:16px;}
.save-error{margin-top:8px;font-size:12px;color:#EB5757;}
.loading-row{display:flex;flex-direction:column;gap:10px;}

/* Perf grid */
.perf-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;}
@media(max-width:600px){.perf-grid{grid-template-columns:repeat(2,1fr);}}
.perf-item{border-radius:8px;background:#F8FAFC;padding:12px;text-align:center;}
.perf-val{font-size:22px;font-weight:700;margin-bottom:4px;}
.perf-label{font-size:10px;color:#94A3B8;text-transform:uppercase;letter-spacing:.4px;}

/* Activity */
.activity-row{display:flex;align-items:flex-start;gap:10px;padding:10px 18px;border-bottom:1px solid #F1F5F9;}
.activity-row:last-child{border-bottom:none;}
.activity-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0;margin-top:3px;}
.activity-body{flex:1;}
.activity-msg{font-size:12px;color:#0F172A;font-weight:500;margin-bottom:2px;}
.activity-time{font-size:11px;color:#94A3B8;}
.empty-activity{padding:20px 18px;font-size:12px;color:#94A3B8;text-align:center;}

/* Settings */
.setting-list{display:flex;flex-direction:column;gap:12px;}
.setting-item{display:flex;align-items:center;gap:10px;}
.setting-icon{width:30px;height:30px;border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.setting-info{flex:1;}
.setting-label{font-size:12px;font-weight:600;color:#0F172A;}
.setting-sub{font-size:11px;color:#94A3B8;}
.setting-action{font-size:11px;color:#2F80ED;font-weight:500;background:none;border:none;cursor:pointer;padding:4px 8px;border-radius:5px;transition:background .15s;}
.setting-action:hover{background:#EBF4FF;}

/* Period */
.period-row{display:flex;align-items:center;gap:10px;margin-bottom:10px;}
.period-dot{width:8px;height:8px;border-radius:50%;background:#27AE60;flex-shrink:0;}
.period-label{font-size:12px;font-weight:600;color:#0F172A;}
.period-dates{font-size:11px;color:#94A3B8;}
.progress-bar-wrap{height:5px;background:#E2E8F0;border-radius:3px;overflow:hidden;margin-bottom:6px;}
.progress-bar{height:100%;background:linear-gradient(90deg,#2F80ED,#1a6cd4);border-radius:3px;transition:width .5s;}
.progress-labels{display:flex;justify-content:space-between;font-size:10px;color:#94A3B8;}

/* Quick actions */
.quick-actions{display:flex;flex-direction:column;}
.quick-btn{display:flex;align-items:center;gap:10px;padding:11px 18px;background:none;border:none;cursor:pointer;font-size:12px;font-weight:500;color:#1A2332;font-family:inherit;border-bottom:1px solid #F1F5F9;transition:background .12s;text-align:left;}
.quick-btn:last-child{border-bottom:none;}
.quick-btn:hover{background:#F8FAFC;}
.quick-btn.logout{color:#EB5757;}
.quick-btn.logout:hover{background:#FFF5F5;}

/* Skeleton */
.skeleton{background:linear-gradient(90deg,#E2E8F0 25%,#F1F5F9 50%,#E2E8F0 75%);background-size:200%;animation:shimmer 1.2s infinite;border-radius:4px;}
.skeleton-dot{width:8px;height:8px;border-radius:50%;background:#E2E8F0;flex-shrink:0;margin-top:3px;}
@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}

/* Buttons */
.btn{padding:7px 14px;border-radius:8px;border:1px solid #E2E8F0;background:#fff;font-size:12px;font-weight:500;color:#1A2332;cursor:pointer;font-family:inherit;transition:all .15s;}
.btn:hover{border-color:#CBD5E1;}
.btn-primary{background:#0D2137;color:#fff;border-color:#0D2137;}
.btn-primary:hover{background:#1e3f61;border-color:#1e3f61;}
.btn:disabled{opacity:.55;cursor:not-allowed;}
.spinner-sm{display:inline-block;width:10px;height:10px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin .6s linear infinite;margin-right:4px;}
@keyframes spin{to{transform:rotate(360deg)}}
</style>