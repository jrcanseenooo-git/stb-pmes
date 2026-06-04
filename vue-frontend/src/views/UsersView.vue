<template>
  <div class="content">

    <!-- Top bar -->
    <div class="top-bar">
      <div class="search-box">
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
          <circle cx="5.5" cy="5.5" r="4" stroke="#94A3B8" stroke-width="1.3"/>
          <path d="M9 9l2.5 2.5" stroke="#94A3B8" stroke-width="1.3" stroke-linecap="round"/>
        </svg>
        <input v-model="search" type="text" placeholder="Search users…"/>
      </div>
      <button class="btn btn-primary" @click="openAddModal">
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
          <circle cx="6.5" cy="5" r="2.5" stroke="currentColor" stroke-width="1.3"/>
          <path d="M1 12c0-3 2.5-5 5.5-5s5.5 2 5.5 5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
          <path d="M10 3v4M12 5H8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
        </svg>
        Add User
      </button>
    </div>

    <!-- Table card -->
    <div class="card">
      <div class="card-hd">
        <span class="card-title">User Management</span>
        <span class="badge badge-blue">{{ loading ? '…' : filteredUsers.length + ' users' }}</span>
      </div>
      <div class="table-wrap">
        <table class="tbl">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Division</th>
              <th>Temp Password</th>
              <th>Status</th>
              <th>Last Login</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>

            <!-- ── Skeleton rows while loading ── -->
            <template v-if="loading">
              <tr v-for="i in 5" :key="'sk'+i" class="skeleton-row">
                <td>
                  <div class="sk-user">
                    <div class="sk-av"></div>
                    <div>
                      <div class="sk-line" style="width:110px;margin-bottom:5px"></div>
                      <div class="sk-line" style="width:70px;height:9px"></div>
                    </div>
                  </div>
                </td>
                <td><div class="sk-line" style="width:140px"></div></td>
                <td><div class="sk-pill"></div></td>
                <td><div class="sk-line" style="width:120px"></div></td>
                <td><div class="sk-line" style="width:80px"></div></td>
                <td><div class="sk-pill" style="width:55px"></div></td>
                <td><div class="sk-line" style="width:60px"></div></td>
                <td><div class="sk-actions"></div></td>
              </tr>
            </template>

            <!-- ── Real data rows ── -->
            <template v-else>
              <tr v-for="(u, i) in filteredUsers" :key="u.email" :class="i % 2 === 1 ? 'stripe' : ''">
                <td>
                  <div class="flex-row gap-8">
                    <div class="av" :style="{ background: u.avatarColor }">{{ u.initials }}</div>
                    <div>
                      <div class="fw-500">{{ u.name }}</div>
                      <div class="text-xs muted">{{ u.employeeNo || '—' }}</div>
                    </div>
                  </div>
                </td>
                <td class="text-xs muted">{{ u.email }}</td>
                <td><span :class="['role-badge', roleBadgeClass(u.role)]">{{ u.role }}</span></td>
                <td class="text-xs muted">{{ u.division || '—' }}</td>
                <td>
                  <div class="flex-row gap-6" v-if="u.tempPassword">
                    <code class="temp-pw">{{ showPw[u.email] ? u.tempPassword : '••••••••' }}</code>
                    <button class="icon-btn-sm" @click="togglePw(u.email)" title="Toggle">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <ellipse cx="6" cy="6" rx="5" ry="3" stroke="#94A3B8" stroke-width="1.2"/>
                        <circle cx="6" cy="6" r="1.5" fill="#94A3B8"/>
                      </svg>
                    </button>
                    <button class="icon-btn-sm" @click="copyPw(u.tempPassword)" title="Copy">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <rect x="4" y="4" width="7" height="7" rx="1" stroke="#94A3B8" stroke-width="1.2"/>
                        <path d="M8 4V2.5a1 1 0 00-1-1h-5a1 1 0 00-1 1v5a1 1 0 001 1H3.5" stroke="#94A3B8" stroke-width="1.2" stroke-linecap="round"/>
                      </svg>
                    </button>
                    <span v-if="copied" class="copied-tag">Copied!</span>
                  </div>
                  <span v-else class="text-xs muted">—</span>
                </td>
                <td>
                  <span :class="['status-badge', u.status === 'Active' ? 's-green' : 's-red']">
                    {{ u.status }}
                  </span>
                </td>
                <td class="text-xs muted">{{ u.lastLogin }}</td>
                <td>
                  <div class="flex-row gap-4">
                    <button class="icon-btn-sm" @click="openEditModal(u)" title="Edit">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M1 9.5L7.5 3l1.5 1.5L2.5 11H1V9.5z" stroke="#64748B" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M6.5 4l1.5-1.5 1.5 1.5L8 5.5" stroke="#64748B" stroke-width="1.2" stroke-linecap="round"/>
                      </svg>
                    </button>
                    <button v-if="u.status === 'Inactive'" class="btn btn-xs activate" @click="activateUser(u)">Activate</button>
                    <button v-else-if="u.status === 'Active'" class="btn btn-xs deactivate" @click="deactivateUser(u)">Deactivate</button>
                    <button class="icon-btn-sm danger" @click="resetPassword(u)" title="Reset password">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6a4 4 0 017-2M10 6a4 4 0 01-7 2M10 4v3H7" stroke="#EF4444" stroke-width="1.2" stroke-linecap="round"/>
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
              <tr v-if="!loading && !filteredUsers.length">
                <td colspan="8" class="empty-row">
                  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" style="margin:0 auto 8px;display:block">
                    <circle cx="16" cy="16" r="14" stroke="#E2E8F0" stroke-width="2"/>
                    <path d="M11 16h10M16 11v10" stroke="#CBD5E1" stroke-width="2" stroke-linecap="round"/>
                  </svg>
                  No users found.
                </td>
              </tr>
            </template>

          </tbody>
        </table>
      </div>
    </div>

    <!-- ══════════════════════════════════════════
         ADD / EDIT USER MODAL — redesigned
         ══════════════════════════════════════════ -->
    <transition name="modal-fade">
      <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
        <div class="modal">

          <!-- Header with colored stripe -->
          <div class="modal-hd">
            <div class="modal-hd-icon">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <circle cx="9" cy="7" r="3" stroke="currentColor" stroke-width="1.6"/>
                <path d="M2 17c0-4 3-7 7-7s7 3 7 7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
                <template v-if="!editingUser">
                  <path d="M14 2v5M16.5 4.5H11.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
                </template>
              </svg>
            </div>
            <div>
              <h3 class="modal-title">{{ editingUser ? 'Edit User' : 'Add New User' }}</h3>
              <p class="modal-sub">{{ editingUser ? 'Update account details and permissions' : 'Create a new PMES account' }}</p>
            </div>
            <button class="modal-close" @click="closeModal">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
              </svg>
            </button>
          </div>

          <div class="modal-body">

            <!-- Section: Identity -->
            <div class="form-section">
              <div class="form-section-label">Identity</div>
              <div class="form-grid">
                <div class="field">
                  <label class="field-label">First Name <span class="req">*</span></label>
                  <input v-model="form.firstName" class="field-input" placeholder="Juan"/>
                </div>
                <div class="field">
                  <label class="field-label">Last Name <span class="req">*</span></label>
                  <input v-model="form.lastName" class="field-input" placeholder="Dela Cruz"/>
                </div>
                <div class="field full">
                  <label class="field-label">Email Address <span class="req">*</span></label>
                  <div class="input-icon-wrap">
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                      <rect x="1" y="3" width="11" height="8" rx="1.5" stroke="#94A3B8" stroke-width="1.2"/>
                      <path d="M1 4l5.5 3.5L12 4" stroke="#94A3B8" stroke-width="1.2" stroke-linecap="round"/>
                    </svg>
                    <input v-model="form.email" type="email" class="field-input has-icon"
                      placeholder="juan.delacruz@dswd.gov.ph" :disabled="!!editingUser"/>
                  </div>
                </div>
              </div>
            </div>

            <!-- Section: Access -->
            <div class="form-section">
              <div class="form-section-label">Access & Assignment</div>
              <div class="form-grid">
                <div class="field">
                  <label class="field-label">Role <span class="req">*</span></label>
                  <select v-model="form.role" class="field-select">
                    <option value="">Select role…</option>
                    <option>System Administrator</option>
                    <option>Bureau Director</option>
                    <option>Assistant Bureau Director</option>
                    <option>Division Chief</option>
                    <option>Staff</option>
                  </select>
                </div>
                <div class="field">
                  <label class="field-label">Division</label>
                  <select v-model="form.division" class="field-select">
                    <option value="">Select division…</option>
                    <option>Admin Pool</option>
                    <option>Design Formulation Division</option>
                    <option>Pilot Implementation Division</option>
                    <option>Social Technology Analysis and Evaluation Division</option>
                  </select>
                </div>
              </div>
            </div>

            <!-- Section: Profile -->
            <div class="form-section">
              <div class="form-section-label">Profile Details</div>
              <div class="form-grid">
                <div class="field">
                  <label class="field-label">Position / Title</label>
                  <input v-model="form.position" class="field-input" placeholder="e.g. Social Welfare Officer II"/>
                </div>
                <div class="field">
                  <label class="field-label">Employee No.</label>
                  <input v-model="form.employeeNo" class="field-input" placeholder="24-0247"/>
                </div>
                <div class="field">
                  <label class="field-label">Employment Type</label>
                  <select v-model="form.type" class="field-select">
                    <option value="Regular">Regular</option>
                    <option value="Contractor of Service (COS)">Contract of Service (COS)</option>
                    <option value="Co-Term">Co-Term</option>
                  </select>
                </div>
              </div>
            </div>

            <!-- Section: Temp Password (add only) -->
            <div v-if="!editingUser" class="form-section pw-section">
              <div class="pw-section-hd">
                <div>
                  <div class="form-section-label" style="margin-bottom:2px">Temporary Password</div>
                  <div class="pw-section-note">Auto-generated. User must change on first login.</div>
                </div>
                <button class="btn btn-sm" @click="regeneratePassword" type="button">
                  <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6a4 4 0 017-2M10 6a4 4 0 01-7 2M10 4v3H7" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
                  </svg>
                  Regenerate
                </button>
              </div>
              <div class="pw-display">
                <code class="pw-code">{{ form.tempPassword }}</code>
                <button class="icon-btn-sm" @click="copyPw(form.tempPassword)" type="button" title="Copy">
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                    <rect x="4.5" y="4.5" width="7" height="7" rx="1" stroke="#64748B" stroke-width="1.2"/>
                    <path d="M8.5 4.5V2.5a1 1 0 00-1-1h-5a1 1 0 00-1 1v5a1 1 0 001 1h2" stroke="#64748B" stroke-width="1.2" stroke-linecap="round"/>
                  </svg>
                </button>
                <span v-if="copied" class="copied-tag">Copied!</span>
              </div>
            </div>

          </div><!-- /modal-body -->

          <div class="modal-footer">
            <button class="btn" @click="closeModal">Cancel</button>
            <button class="btn btn-primary" @click="saveUser" :disabled="saving">
              <span v-if="saving" class="spinner-sm"></span>
              {{ saving ? 'Saving…' : editingUser ? 'Save Changes' : 'Create User' }}
            </button>
          </div>
        </div>
      </div>
    </transition>

    <!-- ── RESET PASSWORD MODAL ── -->
    <transition name="modal-fade">
      <div v-if="showResetModal" class="modal-overlay" @click.self="showResetModal = false">
        <div class="modal modal-sm">
          <div class="modal-hd">
            <div class="modal-hd-icon modal-hd-icon--warn">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M2 6a7 7 0 0112.5-3M16 6a7 7 0 01-12.5 9M16 4v4h-4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
              </svg>
            </div>
            <div>
              <h3 class="modal-title">Reset Password</h3>
              <p class="modal-sub">New temporary password for <strong>{{ resetTarget?.name }}</strong></p>
            </div>
            <button class="modal-close" @click="showResetModal = false">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
          <div class="modal-body">
            <div class="pw-section-inner">
              <div class="pw-section-hd">
                <span class="form-section-label">New Temporary Password</span>
                <button class="btn btn-sm" @click="resetTempPw = generatePassword()" type="button">Regenerate</button>
              </div>
              <div class="pw-display">
                <code class="pw-code">{{ resetTempPw }}</code>
                <button class="icon-btn-sm" @click="copyPw(resetTempPw)" type="button">
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                    <rect x="4.5" y="4.5" width="7" height="7" rx="1" stroke="#64748B" stroke-width="1.2"/>
                    <path d="M8.5 4.5V2.5a1 1 0 00-1-1h-5a1 1 0 00-1 1v5a1 1 0 001 1h2" stroke="#64748B" stroke-width="1.2" stroke-linecap="round"/>
                  </svg>
                </button>
                <span v-if="copied" class="copied-tag">Copied!</span>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn" @click="showResetModal = false">Cancel</button>
            <button class="btn btn-primary" @click="confirmReset">Apply Reset</button>
          </div>
        </div>
      </div>
    </transition>

    <!-- Toast -->
    <transition name="toast-slide">
      <div v-if="toast.show" :class="['toast', `toast-${toast.type}`]">
        <svg v-if="toast.type === 'success'" width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="7" stroke="#22C55E" stroke-width="1.5"/>
          <path d="M5 8l2 2 4-4" stroke="#22C55E" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        {{ toast.msg }}
      </div>
    </transition>

  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { usersApi } from '@/services/api'

const search        = ref('')
const showModal     = ref(false)
const showResetModal = ref(false)
const editingUser   = ref(null)
const resetTarget   = ref(null)
const resetTempPw   = ref('')
const saving        = ref(false)
const loading       = ref(false)
const copied        = ref(false)
const showPw        = ref({})
const toast         = ref({ show: false, msg: '', type: 'success' })
const users         = ref([])

// ── Load users on mount ──
onMounted(async () => {
  loading.value = true
  try {
    const result = await usersApi.list()
    users.value  = (result.items ?? result ?? []).map(mapUser)
  } catch (e) {
    console.warn('[Users]', e.message)
    showToast('Could not load users from database.', 'error')
  } finally {
    loading.value = false
  }
})

// ── Map sheet row → display object ──
function mapUser(row) {
  const colors = ['#3B82F6','#22C55E','#F59E0B','#EF4444','#8B5CF6','#06B6D4','#0D2137','#1e3f61','#27AE60','#E9A840','#EB5757']
  const name   = row.fullName || `${row.firstName || ''} ${row.lastName || ''}`.trim() || row.email
  return {
    id:           row.id,
    uid:          row.uid || '',
    initials:     name.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase(),
    name,
    email:        row.email        || '',
    role:         row.role         || 'Staff',
    division:     row.divisionName || row.divisionId || '',
    divisionId:   row.divisionId   || '',
    position:     row.position     || '',
    employeeNo:   row.employeeNo   || '',
    type:         row.type         || 'Regular',
    status:       row.active === false || row.active === 'false' ? 'Inactive' : 'Active',
    lastLogin:    row.lastLoginAt ? formatDate(row.lastLoginAt) : 'Never',
    tempPassword: row.tempPassword || '',
    avatarColor:  colors[Math.abs(hashStr(row.email)) % colors.length]
  }
}

function hashStr(s) { return (s||'').split('').reduce((a,c) => a + c.charCodeAt(0), 0) }

function formatDate(iso) {
  if (!iso) return 'Never'
  const d = new Date(iso), now = new Date()
  if (d.toDateString() === now.toDateString()) return 'Today'
  return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
}

// ── Password ──
function generatePassword() {
  const upper='ABCDEFGHJKLMNPQRSTUVWXYZ', lower='abcdefghjkmnpqrstuvwxyz'
  const digits='23456789', special='@#$%', all=upper+lower+digits+special
  let pw = upper[~~(Math.random()*upper.length)] + lower[~~(Math.random()*lower.length)]
         + digits[~~(Math.random()*digits.length)] + special[~~(Math.random()*special.length)]
  for (let i=0;i<6;i++) pw += all[~~(Math.random()*all.length)]
  return pw.split('').sort(() => Math.random()-.5).join('')
}

// ── Form ──
const defaultForm = () => ({
  firstName:'', lastName:'', email:'',
  role:'', division:'', position:'',
  employeeNo:'', type:'Regular',
  tempPassword: generatePassword()
})

const form = ref(defaultForm())
function regeneratePassword() { form.value.tempPassword = generatePassword() }

// ── Filter ──
const filteredUsers = computed(() => {
  const q = search.value.toLowerCase()
  if (!q) return users.value
  return users.value.filter(u =>
    u.name.toLowerCase().includes(q) ||
    u.email.toLowerCase().includes(q) ||
    u.role.toLowerCase().includes(q) ||
    (u.division||'').toLowerCase().includes(q)
  )
})

// ── Modal ──
function openAddModal()  { editingUser.value = null; form.value = defaultForm(); showModal.value = true }
function closeModal()    { showModal.value = false }

function openEditModal(user) {
  editingUser.value = user
  form.value = {
    firstName:  user.name.split(' ')[0],
    lastName:   user.name.split(' ').slice(1).join(' '),
    email:      user.email,
    role:       user.role,
    division:   user.division,
    position:   user.position    || '',
    employeeNo: user.employeeNo  || '',
    type:       user.type        || 'Regular',
    tempPassword: ''
  }
  showModal.value = true
}

// ── Save ──
async function saveUser() {
  if (!form.value.firstName || !form.value.lastName || !form.value.email || !form.value.role) {
    showToast('Please fill in all required fields.', 'error'); return
  }
  saving.value = true
  try {
    const payload = {
      fullName:    `${form.value.firstName} ${form.value.lastName}`,
      firstName:   form.value.firstName,
      lastName:    form.value.lastName,
      email:       form.value.email,
      role:        form.value.role,
      divisionName: form.value.division,
      position:    form.value.position,
      employeeNo:  form.value.employeeNo,
      type:        form.value.type
    }
    if (editingUser.value) {
      const updated = await usersApi.update(editingUser.value.id, payload)
      const idx = users.value.findIndex(u => u.id === editingUser.value.id)
      if (idx !== -1) users.value[idx] = mapUser(updated)
      showToast('User updated successfully.')
    } else {
      const newUser = await usersApi.create({ ...payload, tempPassword: form.value.tempPassword, mustChangePassword: true })
      users.value.unshift(mapUser(newUser))
      showToast(`User created! Temp password: ${form.value.tempPassword}`)
    }
    closeModal()
  } catch (e) {
    showToast(`Failed: ${e.message}`, 'error')
  } finally {
    saving.value = false
  }
}

// ── Activate / Deactivate ──
async function activateUser(user) {
  try   { await usersApi.activate(user.id); user.status = 'Active';   showToast(`${user.name} activated.`) }
  catch (e) { showToast(`Failed: ${e.message}`, 'error') }
}
async function deactivateUser(user) {
  try   { await usersApi.deactivate(user.id); user.status = 'Inactive'; showToast(`${user.name} deactivated.`, 'warning') }
  catch (e) { showToast(`Failed: ${e.message}`, 'error') }
}

// ── Reset password ──
function resetPassword(user) { resetTarget.value = user; resetTempPw.value = generatePassword(); showResetModal.value = true }
async function confirmReset() {
  try {
    await usersApi.update(resetTarget.value.id, { tempPassword: resetTempPw.value, mustChangePassword: true })
    resetTarget.value.tempPassword = resetTempPw.value
    showToast(`Password reset for ${resetTarget.value.name}.`)
  } catch (e) { showToast(`Failed: ${e.message}`, 'error') }
  finally { showResetModal.value = false }
}

// ── Helpers ──
function togglePw(email) { showPw.value = { ...showPw.value, [email]: !showPw.value[email] } }
async function copyPw(pw) {
  try { await navigator.clipboard.writeText(pw); copied.value = true; setTimeout(() => { copied.value = false }, 2000) } catch {}
}

function roleBadgeClass(role) {
  const map = {
    'System Administrator': 'role-admin',
    'Bureau Director': 'role-director',
    'Assistant Bureau Director': 'role-director',
    'Division Chief': 'role-chief',
    'Staff': 'role-staff',
    'Contractor of Service': 'role-contractor'
  }
  return map[role] || 'role-staff'
}

function showToast(msg, type='success') {
  toast.value = { show: true, msg, type }
  setTimeout(() => { toast.value.show = false }, 3500)
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap');
*{box-sizing:border-box;}
.content{padding:16px 20px 20px;font-family:'DM Sans',sans-serif;font-size:13px;color:#1A2332;background:#EEF2F7;min-height:100%;}

/* Top bar */
.top-bar{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;}
.search-box{display:flex;align-items:center;gap:8px;background:#fff;border:1px solid #E2E8F0;border-radius:8px;padding:7px 12px;width:260px;}
.search-box input{border:none;outline:none;font-size:13px;font-family:'DM Sans',sans-serif;color:#1A2332;width:100%;}

/* Buttons */
.btn{display:inline-flex;align-items:center;gap:5px;padding:7px 13px;border-radius:8px;font-size:12px;cursor:pointer;border:1px solid #E2E8F0;background:#fff;color:#374151;transition:all .15s;font-family:'DM Sans',sans-serif;font-weight:500;}
.btn:hover{border-color:#CBD5E1;background:#F8FAFC;}
.btn-primary{background:#0D2137;color:#fff;border-color:#0D2137;}
.btn-primary:hover{background:#1e3f61;border-color:#1e3f61;}
.btn:disabled{opacity:.55;cursor:not-allowed;}
.btn-sm{padding:4px 9px;font-size:11px;}
.btn-xs{padding:3px 8px;font-size:10px;border-radius:5px;}
.activate{background:#F0FDF4;color:#15803D;border-color:#BBF7D0;}
.activate:hover{background:#DCFCE7;}
.deactivate{background:#FEF2F2;color:#B91C1C;border-color:#FECACA;}
.deactivate:hover{background:#FFE4E6;}

/* Card */
.card{background:#fff;border:1px solid #E2E8F0;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.04);}
.card-hd{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid #F1F5F9;}
.card-title{font-size:12px;font-weight:600;color:#64748B;text-transform:uppercase;letter-spacing:.5px;}
.badge{display:inline-flex;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:500;}
.badge-blue{background:#EBF4FF;color:#1A56B0;}

/* Table */
.table-wrap{overflow-x:auto;}
.tbl{width:100%;border-collapse:collapse;}
.tbl th{padding:9px 14px;text-align:left;font-size:10px;font-weight:600;color:#94A3B8;text-transform:uppercase;letter-spacing:.4px;white-space:nowrap;border-bottom:1px solid #F1F5F9;}
.tbl td{padding:11px 14px;border-bottom:1px solid #F8FAFC;vertical-align:middle;}
.tbl tr:last-child td{border-bottom:none;}
.tbl tr:hover td{background:#FAFAFA;}
.stripe td{background:rgba(59,130,246,.02);}
.empty-row{text-align:center;color:#94A3B8;padding:40px !important;font-size:13px;}
.flex-row{display:flex;align-items:center;}
.gap-4{gap:4px;} .gap-6{gap:6px;} .gap-8{gap:8px;}
.fw-500{font-weight:500;font-size:13px;}
.text-xs{font-size:11px;} .muted{color:#94A3B8;}

/* Avatar */
.av{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#fff;flex-shrink:0;}

/* Badges */
.role-badge{display:inline-flex;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:600;}
.role-admin{background:#F3EEFF;color:#6B3FA0;}
.role-director{background:#EBF4FF;color:#1A56B0;}
.role-chief{background:#E6F4EA;color:#1E7E34;}
.role-staff{background:#F0F4F8;color:#4A5568;}
.role-contractor{background:#FEF3E2;color:#B35A0F;}
.status-badge{display:inline-flex;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:500;}
.s-green{background:#F0FDF4;color:#15803D;}
.s-red{background:#FEF2F2;color:#B91C1C;}

/* Temp pw */
.temp-pw{font-family:'DM Mono',monospace;font-size:11px;color:#0F172A;background:#F1F5F9;padding:3px 7px;border-radius:5px;letter-spacing:.5px;}
.icon-btn-sm{background:none;border:none;cursor:pointer;padding:3px;border-radius:4px;color:#94A3B8;transition:all .15s;}
.icon-btn-sm:hover{background:#F1F5F9;color:#64748B;}
.icon-btn-sm.danger:hover{background:#FEF2F2;color:#EF4444;}
.copied-tag{font-size:10px;color:#22C55E;font-weight:500;}

/* ─── SKELETON ─────────────────────────────── */
@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
.sk-line,.sk-pill,.sk-av,.sk-actions{
  background:linear-gradient(90deg,#E2E8F0 25%,#F1F5F9 50%,#E2E8F0 75%);
  background-size:200%;animation:shimmer 1.4s infinite;border-radius:4px;
}
.sk-line{height:11px;display:block;}
.sk-pill{height:18px;width:70px;border-radius:20px;display:inline-block;}
.sk-av{width:28px;height:28px;border-radius:50%;flex-shrink:0;}
.sk-user{display:flex;align-items:center;gap:8px;}
.sk-actions{width:60px;height:18px;}
.skeleton-row td{padding:12px 14px;}

/* ─── MODAL ─────────────────────────────────── */
.modal-overlay{position:fixed;inset:0;background:rgba(15,23,42,.5);display:flex;align-items:center;justify-content:center;z-index:200;padding:16px;backdrop-filter:blur(4px);}
.modal{background:#fff;border-radius:16px;width:100%;max-width:600px;box-shadow:0 24px 64px rgba(0,0,0,.2);overflow:hidden;max-height:92vh;display:flex;flex-direction:column;}
.modal-sm{max-width:440px;}

/* Modal header */
.modal-hd{display:flex;align-items:center;gap:12px;padding:20px 24px 16px;border-bottom:1px solid #F1F5F9;background:#FAFBFF;}
.modal-hd-icon{width:36px;height:36px;border-radius:10px;background:#EBF4FF;color:#2F80ED;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.modal-hd-icon--warn{background:#FEF3E2;color:#C8882A;}
.modal-title{font-size:15px;font-weight:700;color:#0F172A;margin-bottom:1px;}
.modal-sub{font-size:12px;color:#94A3B8;}
.modal-close{margin-left:auto;background:none;border:none;cursor:pointer;padding:6px;border-radius:8px;color:#94A3B8;transition:all .15s;flex-shrink:0;}
.modal-close:hover{background:#F1F5F9;color:#374151;}

/* Modal body */
.modal-body{padding:20px 24px;overflow-y:auto;flex:1;}

/* Form sections */
.form-section{margin-bottom:20px;}
.form-section:last-child{margin-bottom:0;}
.form-section-label{font-size:10px;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:.6px;margin-bottom:10px;display:flex;align-items:center;gap:6px;}
.form-section-label::after{content:'';flex:1;height:1px;background:#F1F5F9;}

.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
.field{display:flex;flex-direction:column;gap:5px;}
.full{grid-column:span 2;}
.field-label{font-size:11px;font-weight:600;color:#374151;}
.req{color:#EF4444;}

.field-input,.field-select{
  padding:9px 12px;border:1.5px solid #E2E8F0;border-radius:9px;
  font-size:13px;font-family:'DM Sans',sans-serif;color:#0F172A;
  background:#fff;outline:none;transition:border-color .15s,box-shadow .15s;width:100%;
}
.field-input:focus,.field-select:focus{border-color:#3B82F6;box-shadow:0 0 0 3px rgba(59,130,246,.1);}
.field-input:disabled{background:#F8FAFC;color:#94A3B8;cursor:not-allowed;}
.field-input::placeholder{color:#CBD5E1;}
.field-select{cursor:pointer;}

/* Email input with icon */
.input-icon-wrap{position:relative;}
.input-icon-wrap svg{position:absolute;left:11px;top:50%;transform:translateY(-50%);pointer-events:none;}
.field-input.has-icon{padding-left:32px;}

/* Password section inside modal */
.pw-section{background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;padding:14px;}
.pw-section-inner{background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;padding:14px;}
.pw-section-hd{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;}
.pw-section-note{font-size:11px;color:#94A3B8;margin-top:2px;}
.pw-display{display:flex;align-items:center;gap:8px;}
.pw-code{font-family:'DM Mono',monospace;font-size:13px;color:#0F172A;background:#fff;border:1px solid #E2E8F0;padding:6px 12px;border-radius:7px;letter-spacing:.8px;flex:1;}

/* Modal footer */
.modal-footer{display:flex;justify-content:flex-end;gap:8px;padding:14px 24px;border-top:1px solid #F1F5F9;background:#F8FAFC;}

/* Spinner */
.spinner-sm{display:inline-block;width:11px;height:11px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin .6s linear infinite;margin-right:4px;}
@keyframes spin{to{transform:rotate(360deg)}}

/* Toast */
.toast{position:fixed;bottom:24px;right:24px;background:#0F172A;color:#fff;padding:10px 16px;border-radius:10px;font-size:13px;display:flex;align-items:center;gap:8px;box-shadow:0 8px 24px rgba(0,0,0,.2);z-index:999;}
.toast-error{background:#EB5757;}
.toast-warning{background:#E9A840;}

/* Transitions */
.modal-fade-enter-active,.modal-fade-leave-active{transition:opacity .2s,transform .2s;}
.modal-fade-enter-from,.modal-fade-leave-to{opacity:0;transform:scale(.97);}
.toast-slide-enter-active,.toast-slide-leave-active{transition:all .25s;}
.toast-slide-enter-from,.toast-slide-leave-to{opacity:0;transform:translateY(8px);}
</style>