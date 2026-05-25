<template>
  <div class="content">

    <!-- Profile header -->
    <div class="profile-header">
      <div class="avatar-wrap">
        <div class="avatar">{{ initials }}</div>
        <div class="avatar-badge">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2 2 4-4" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </div>
      </div>
      <div class="profile-info">
        <h2 class="profile-name">{{ fullName }}</h2>
        <p class="profile-role">{{ role }}</p>
        <p class="profile-email">{{ email }}</p>
        <div class="profile-tags">
          <span class="tag tag-blue">{{ role }}</span>
          <span class="tag tag-green">Active</span>
          <span class="tag tag-gray">S1 2025</span>
        </div>
      </div>
      <button class="btn btn-primary" @click="editMode = !editMode">
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M1 10L8.5 2.5l2 2L3 12H1V10z" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
        {{ editMode ? 'Cancel' : 'Edit Profile' }}
      </button>
    </div>

    <div class="grid-3-1">

      <!-- Left: details -->
      <div class="left-col">

        <!-- Personal Info -->
        <div class="card mb-10">
          <div class="card-hd">
            <span class="card-title">Personal Information</span>
          </div>
          <div class="card-body">
            <div class="info-grid">
              <div class="info-item">
                <label class="info-label">Full Name</label>
                <div v-if="!editMode" class="info-val">{{ fullName }}</div>
                <input v-else v-model="form.fullName" class="field-input"/>
              </div>
              <div class="info-item">
                <label class="info-label">Employee No.</label>
                <div v-if="!editMode" class="info-val">DSWD-2021-0042</div>
                <input v-else value="DSWD-2021-0042" class="field-input"/>
              </div>
              <div class="info-item">
                <label class="info-label">Email Address</label>
                <div v-if="!editMode" class="info-val">{{ email }}</div>
                <input v-else v-model="form.email" class="field-input"/>
              </div>
              <div class="info-item">
                <label class="info-label">Position / Title</label>
                <div v-if="!editMode" class="info-val">{{ role }}</div>
                <input v-else v-model="form.role" class="field-input"/>
              </div>
              <div class="info-item">
                <label class="info-label">Division</label>
                <div v-if="!editMode" class="info-val">Bureau of Social Technology</div>
                <input v-else value="Bureau of Social Technology" class="field-input"/>
              </div>
              <div class="info-item">
                <label class="info-label">Date Joined</label>
                <div class="info-val">January 15, 2021</div>
              </div>
            </div>
            <div v-if="editMode" class="save-row">
              <button class="btn btn-primary" @click="saveProfile">Save Changes</button>
              <button class="btn" @click="editMode=false">Cancel</button>
            </div>
          </div>
        </div>

        <!-- Performance Summary -->
        <div class="card mb-10">
          <div class="card-hd">
            <span class="card-title">Performance Summary</span>
            <span class="sem-tag">S1 2025</span>
          </div>
          <div class="card-body">
            <div class="perf-grid">
              <div v-for="p in perfStats" :key="p.label" class="perf-item" :style="{ borderTop: '2px solid '+p.color }">
                <div class="perf-val" :style="{ color: p.color }">{{ p.value }}</div>
                <div class="perf-label">{{ p.label }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Recent Activity -->
        <div class="card">
          <div class="card-hd"><span class="card-title">Recent Activity</span></div>
          <div class="card-body pd-0">
            <div v-for="a in activity" :key="a.msg" class="activity-row">
              <div class="activity-dot" :style="{ background: a.color }"></div>
              <div class="activity-body">
                <div class="activity-msg">{{ a.msg }}</div>
                <div class="activity-time">{{ a.time }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Right: sidebar info -->
      <div class="right-col">

        <!-- Account settings -->
        <div class="card mb-10">
          <div class="card-hd"><span class="card-title">Account Settings</span></div>
          <div class="card-body">
            <div class="setting-list">
              <div v-for="s in settings" :key="s.label" class="setting-item">
                <div class="setting-icon" :style="{ background: s.iconBg, color: s.iconColor }">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path :d="s.icon" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </div>
                <div class="setting-info">
                  <div class="setting-label">{{ s.label }}</div>
                  <div class="setting-sub">{{ s.sub }}</div>
                </div>
                <button class="btn btn-xs">{{ s.action }}</button>
              </div>
            </div>
          </div>
        </div>

        <!-- Current period -->
        <div class="card mb-10">
          <div class="card-hd"><span class="card-title">Current Period</span></div>
          <div class="card-body">
            <div class="period-item">
              <div class="period-dot green"></div>
              <div>
                <div class="period-label">Semester 1, 2025</div>
                <div class="period-sub">Jan 1 – Jun 30, 2025</div>
              </div>
            </div>
            <div class="prog-wrap mt-8">
              <div class="prog-fill" style="width:72%;background:#2F80ED"></div>
            </div>
            <div class="period-footer">
              <span class="text-xs muted">72% of semester complete</span>
              <span class="text-xs muted">54 days left</span>
            </div>
          </div>
        </div>

        <!-- Quick actions -->
        <div class="card">
          <div class="card-hd"><span class="card-title">Quick Actions</span></div>
          <div class="card-body">
            <div class="quick-actions">
              <button class="quick-btn" @click="$router.push('/accomplishments')">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="1" width="14" height="14" rx="2" stroke="#2F80ED" stroke-width="1.4"/><path d="M4.5 8l2.5 2.5L11.5 5" stroke="#2F80ED" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
                View Accomplishments
              </button>
              <button class="quick-btn" @click="$router.push('/mov')">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M9 1H4a1 1 0 00-1 1v12a1 1 0 001 1h8a1 1 0 001-1V7L9 1z" stroke="#27AE60" stroke-width="1.4"/><path d="M9 1v6h6" stroke="#27AE60" stroke-width="1.4" stroke-linecap="round"/></svg>
                Upload MOV
              </button>
              <button class="quick-btn" @click="$router.push('/evaluation')">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1.5l1.8 3.6 3.7.5-2.75 2.7.65 3.8L8 10.3l-3.4 1.8.65-3.8L2.5 5.6l3.7-.5L8 1.5z" stroke="#E9A840" stroke-width="1.4" stroke-linejoin="round"/></svg>
                View Ratings
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
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()
const router    = useRouter()
const editMode  = ref(false)

const fullName = computed(() => authStore.fullName || 'User')
const role     = computed(() => authStore.role     || 'Staff')
const email    = computed(() => authStore.user?.email || 'user@dswd.gov.ph')
const initials = computed(() => authStore.initials || 'U')

const form = ref({ fullName: fullName.value, email: email.value, role: role.value })

function saveProfile() {
  editMode.value = false
  alert('Profile updated (connect to API to persist)')
}

async function handleLogout() {
  await authStore.logout()
  router.push('/auth/login')
}

const perfStats = [
  { label: 'Targets',       value: '12',   color: '#2F80ED' },
  { label: 'Completed',     value: '9',    color: '#27AE60' },
  { label: 'Pending',       value: '2',    color: '#E9A840' },
  { label: 'Rating',        value: '4.25', color: '#27AE60' }
]

const activity = [
  { msg:'Submitted Q1 IPCR accomplishment entry',      time:'May 11, 2025 · 9:00 AM',  color:'#2F80ED' },
  { msg:'Uploaded MOV: Training_Matrix_Q1.pdf',         time:'May 10, 2025 · 2:30 PM',  color:'#27AE60' },
  { msg:'Revision requested on KRA 2 – SI-3',           time:'May 9, 2025 · 10:00 AM',  color:'#E9A840' },
  { msg:'Accomplishment approved by Division Chief',    time:'May 8, 2025 · 4:00 PM',   color:'#27AE60' },
  { msg:'Logged in to PMES',                            time:'May 8, 2025 · 8:01 AM',   color:'#718096' }
]

const settings = [
  { label:'Change Password',     sub:'Last changed 3 months ago',         action:'Change', icon:'M1 7s2-5 6-5 6 5 6 5-2 5-6 5-6-5-6-5zM8 7a2 2 0 01-2 2 2 2 0 01-2-2 2 2 0 012-2 2 2 0 012 2z', iconBg:'#EBF4FF', iconColor:'#2F80ED' },
  { label:'Email Notifications', sub:'Receive deadline & approval alerts', action:'Manage', icon:'M1 4a1 1 0 011-1h10a1 1 0 011 1v6a1 1 0 01-1 1H2a1 1 0 01-1-1V4zM1 5l6 4 6-4', iconBg:'#E6F4EA', iconColor:'#27AE60' },
  { label:'Two-Factor Auth',     sub:'Not yet enabled',                    action:'Enable', icon:'M7 1L1 3.5v4c0 3 2.5 5 6 5.5 3.5-.5 6-2.5 6-5.5v-4L7 1z', iconBg:'#FEF3E2', iconColor:'#C8882A' }
]
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
.tag-blue  {background:#EBF4FF;color:#1A56B0;}
.tag-green {background:#E6F4EA;color:#1E7E34;}
.tag-gray  {background:#F0F4F8;color:#4A5568;}

/* Layout */
.grid-3-1{display:grid;grid-template-columns:1fr 300px;gap:14px;}
.left-col{display:flex;flex-direction:column;}
.right-col{display:flex;flex-direction:column;}
.mb-10{margin-bottom:12px;}

/* Card */
.card{background:#fff;border:1px solid #E2E8F0;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.04);}
.card-hd{padding:12px 16px;border-bottom:1px solid #E2E8F0;display:flex;align-items:center;justify-content:space-between;}
.card-title{font-size:12px;font-weight:600;color:#1A2332;}
.card-body{padding:16px;}
.pd-0{padding:0;}

.sem-tag{display:inline-flex;padding:2px 8px;background:linear-gradient(135deg,#EBF4FF,#F3EEFF);border:1px solid #C7D8F6;border-radius:20px;font-size:10px;color:#1A56B0;font-weight:500;}

/* Info grid */
.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:0;}
.info-item{display:flex;flex-direction:column;gap:3px;}
.info-label{font-size:10px;color:#94A3B8;text-transform:uppercase;letter-spacing:.4px;font-weight:500;}
.info-val{font-size:13px;color:#1A2332;font-weight:500;}
.field-input{padding:6px 9px;border:1px solid #E2E8F0;border-radius:6px;font-size:12px;font-family:'DM Sans',sans-serif;color:#1A2332;outline:none;transition:border-color .15s;}
.field-input:focus{border-color:#2F80ED;}
.save-row{display:flex;gap:8px;margin-top:14px;padding-top:14px;border-top:1px solid #E2E8F0;}

/* Performance */
.perf-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;}
.perf-item{padding:10px;border-radius:8px;background:#F7FAFC;text-align:center;}
.perf-val{font-size:20px;font-weight:700;font-family:'DM Mono',monospace;margin-bottom:2px;}
.perf-label{font-size:9px;color:#718096;text-transform:uppercase;letter-spacing:.4px;}

/* Activity */
.activity-row{display:flex;align-items:flex-start;gap:10px;padding:10px 16px;border-bottom:1px solid #E2E8F0;}
.activity-row:last-child{border-bottom:none;}
.activity-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0;margin-top:3px;}
.activity-msg{font-size:12px;color:#374151;margin-bottom:2px;}
.activity-time{font-size:10px;color:#94A3B8;}

/* Settings */
.setting-list{display:flex;flex-direction:column;gap:10px;}
.setting-item{display:flex;align-items:center;gap:10px;}
.setting-icon{width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.setting-info{flex:1;}
.setting-label{font-size:12px;font-weight:500;color:#1A2332;}
.setting-sub{font-size:10px;color:#94A3B8;margin-top:1px;}

/* Period */
.period-item{display:flex;align-items:center;gap:10px;margin-bottom:10px;}
.period-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0;}
.period-dot.green{background:#27AE60;}
.period-label{font-size:12px;font-weight:500;color:#1A2332;}
.period-sub{font-size:10px;color:#94A3B8;}
.prog-wrap{height:5px;background:#E2E8F0;border-radius:3px;overflow:hidden;}
.prog-fill{height:100%;border-radius:3px;transition:width .5s;}
.mt-8{margin-top:8px;}
.period-footer{display:flex;justify-content:space-between;margin-top:6px;}
.text-xs{font-size:10px;}.muted{color:#718096;}

/* Quick actions */
.quick-actions{display:flex;flex-direction:column;gap:6px;}
.quick-btn{display:flex;align-items:center;gap:8px;padding:9px 12px;border:1px solid #E2E8F0;border-radius:8px;background:#F7FAFC;cursor:pointer;font-size:12px;color:#374151;font-family:'DM Sans',sans-serif;transition:all .15s;text-align:left;}
.quick-btn:hover{background:#EBF4FF;border-color:#BFDBFE;color:#1D4ED8;}
.quick-btn.logout:hover{background:#FFF1F2;border-color:#FECACA;color:#B91C1C;}

/* Buttons */
.btn{display:inline-flex;align-items:center;gap:5px;padding:7px 12px;border-radius:7px;font-size:11px;cursor:pointer;border:1px solid #E2E8F0;background:#fff;color:#4A5568;transition:all .15s;font-family:'DM Sans',sans-serif;}
.btn:hover{background:#F7FAFC;border-color:#2F80ED;color:#2F80ED;}
.btn-primary{background:#2F80ED;color:#fff;border-color:#2F80ED;}
.btn-primary:hover{background:#1a6cd4;color:#fff;}
.btn-xs{padding:3px 9px;font-size:10px;}

@media (max-width:900px){
  .grid-3-1{grid-template-columns:1fr;}
  .perf-grid{grid-template-columns:1fr 1fr;}
  .info-grid{grid-template-columns:1fr;}
}
</style>