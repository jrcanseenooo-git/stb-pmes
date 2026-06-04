<template>
  <div class="content">

    <!-- Top bar -->
    <div class="flex-row jc-sb mb-12">
      <div class="search-box">
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
          <circle cx="5.5" cy="5.5" r="4" stroke="#94A3B8" stroke-width="1.3" />
          <path d="M9 9l2.5 2.5" stroke="#94A3B8" stroke-width="1.3" stroke-linecap="round" />
        </svg>
        <input v-model="search" type="text" placeholder="Search users..." />
      </div>
      <button class="btn btn-primary" @click="openAddModal">
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
          <circle cx="6.5" cy="5" r="2.5" stroke="currentColor" stroke-width="1.3" />
          <path d="M1 12c0-3 2.5-5 5.5-5s5.5 2 5.5 5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
          <path d="M10 3v4M12 5H8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
        </svg>
        Add User
      </button>
    </div>

    <!-- Table -->
    <div class="card">
      <div class="card-hd">
        <span class="card-title">User Management</span>
        <span class="badge badge-blue">{{ filteredUsers.length }} users</span>
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
                  <button class="icon-btn-sm" @click="togglePw(u.email)" title="Toggle visibility">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M1 6s2-4 5-4 5 4 5 4-2 4-5 4-5-4-5-4z" stroke="#64748B" stroke-width="1.2" />
                      <circle cx="6" cy="6" r="1.5" stroke="#64748B" stroke-width="1.2" />
                    </svg>
                  </button>
                  <button class="icon-btn-sm" @click="copyPw(u.tempPassword)" title="Copy">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <rect x="4" y="4" width="7" height="7" rx="1" stroke="#64748B" stroke-width="1.2" />
                      <path d="M8 4V2a1 1 0 00-1-1H2a1 1 0 00-1 1v5a1 1 0 001 1h2" stroke="#64748B" stroke-width="1.2"
                        stroke-linecap="round" />
                    </svg>
                  </button>
                </div>
                <span v-else class="text-xs muted">—</span>
              </td>
              <td>
                <span :class="['status-badge', u.status === 'Active' ? 's-green' : u.status === 'Inactive' ? 's-red' : 's-orange']">
                  {{ u.status }}
                </span>
              </td>
              <td class="text-xs muted">{{ u.lastLogin }}</td>
              <td>
                <div class="flex-row gap-4">
                  <button class="icon-btn-sm" @click="openEditModal(u)" title="Edit">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M1 9.5L7.5 3l1.5 1.5L2.5 11H1V9.5z" stroke="#64748B" stroke-width="1.2"
                        stroke-linecap="round" stroke-linejoin="round" />
                      <path d="M6.5 4l1.5-1.5 1.5 1.5L8 5.5" stroke="#64748B" stroke-width="1.2"
                        stroke-linecap="round" />
                    </svg>
                  </button>
                  <button v-if="u.status === 'Inactive'" class="btn btn-xs activate"
                    @click="activateUser(u)">Activate</button>
                  <button v-else-if="u.status === 'Active'" class="btn btn-xs deactivate"
                    @click="deactivateUser(u)">Deactivate</button>
                  <button class="icon-btn-sm danger" @click="resetPassword(u)" title="Reset password">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6a4 4 0 017-2M10 6a4 4 0 01-7 2M10 4v3H7" stroke="#EF4444" stroke-width="1.2"
                        stroke-linecap="round" />
                    </svg>
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="!filteredUsers.length">
              <td colspan="8" class="empty-row">No users found.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ── ADD / EDIT USER MODAL ── -->
    <transition name="modal-fade">
      <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
        <div class="modal">
          <div class="modal-hd">
            <div>
              <h3 class="modal-title">{{ editingUser ? 'Edit User' : 'Add New User' }}</h3>
              <p class="modal-sub">{{ editingUser ? 'Update user details and permissions' : 'Create a new PMES account with a temporary password' }}</p>
            </div>
            <button class="modal-close" @click="closeModal">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 3l10 10M13 3L3 13" stroke="#64748B" stroke-width="1.5" stroke-linecap="round" />
              </svg>
            </button>
          </div>

          <div class="modal-body">
            <div class="form-grid">
              <div class="field">
                <label class="field-label">First Name <span class="req">*</span></label>
                <input v-model="form.firstName" class="field-input" placeholder="Juan" required />
              </div>
              <div class="field">
                <label class="field-label">Last Name <span class="req">*</span></label>
                <input v-model="form.lastName" class="field-input" placeholder="Dela Cruz" required />
              </div>
              <div class="field full">
                <label class="field-label">Email Address <span class="req">*</span></label>
                <input v-model="form.email" type="email" class="field-input" placeholder="juan.delacruz@dswd.gov.ph"
                  required />
              </div>
              <div class="field">
                <label class="field-label">Role <span class="req">*</span></label>
                <select v-model="form.role" class="field-select">
                  <option value="">Select role...</option>
                  <option>System Administrator</option>
                  <option>Bureau Director</option>
                  <option>Assistant Bureau Director</option>
                  <option>Division Chief</option>
                  <option>Staff</option>
                  <option>Contractor of Service</option>
                </select>
              </div>
              <div class="field">
                <label class="field-label">Division</label>
                <select v-model="form.division" class="field-select">
                  <option value="">Select division...</option>
                  <option>Admin Pool</option>
                  <option>Design Formulation Division</option>
                  <option>Pilot Implementation Division</option>
                  <option>Social Technology Analysis and Evaluation Division</option>
                </select>
              </div>
              <div class="field">
                <label class="field-label">Position / Title</label>
                <input v-model="form.position" class="field-input" placeholder="e.g. Project Development Officer II" />
              </div>
              <div class="field">
                <label class="field-label">Employee No.</label>
                <input v-model="form.employeeNo" class="field-input" placeholder="DSWD-2024-XXXX" />
              </div>
              <div class="field">
                <label class="field-label">Employment Type</label>
                <select v-model="form.type" class="field-select">
                  <option>Regular</option>
                  <option>Contract of Service (COS)</option>
                  <option>Co-Term</option>
                </select>
              </div>
            </div>

            <!-- Temp password section (only for new users) -->
            <div v-if="!editingUser" class="pw-section">
              <div class="pw-section-hd">
                <div>
                  <div class="pw-section-title">Temporary Password</div>
                  <div class="pw-section-sub">Auto-generated. User must change on first login.</div>
                </div>
                <button class="btn btn-sm" @click="regeneratePassword" type="button">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6a4 4 0 017-2M10 6a4 4 0 01-7 2M10 4v3H7" stroke="currentColor" stroke-width="1.2"
                      stroke-linecap="round" />
                  </svg>
                  Regenerate
                </button>
              </div>
              <div class="pw-display">
                <code class="pw-code">{{ form.tempPassword }}</code>
                <button class="icon-btn-sm" @click="copyPw(form.tempPassword)" type="button" title="Copy">
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                    <rect x="4.5" y="4.5" width="7" height="7" rx="1" stroke="#64748B" stroke-width="1.2" />
                    <path d="M8.5 4.5V2.5a1 1 0 00-1-1h-5a1 1 0 00-1 1v5a1 1 0 001 1h2" stroke="#64748B"
                      stroke-width="1.2" stroke-linecap="round" />
                  </svg>
                </button>
                <span v-if="copied" class="copied-tag">Copied!</span>
              </div>
              <div class="pw-note">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <circle cx="6" cy="6" r="5" stroke="#F59E0B" stroke-width="1.2" />
                  <path d="M6 5v3M6 4v.1" stroke="#F59E0B" stroke-width="1.2" stroke-linecap="round" />
                </svg>
                Share this password with the user securely. They will be prompted to change it on first login.
              </div>
            </div>
          </div>

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
            <div>
              <h3 class="modal-title">Reset Password</h3>
              <p class="modal-sub">A new temporary password will be generated for {{ resetTarget?.name }}</p>
            </div>
            <button class="modal-close" @click="showResetModal = false">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 3l10 10M13 3L3 13" stroke="#64748B" stroke-width="1.5" stroke-linecap="round" />
              </svg>
            </button>
          </div>
          <div class="modal-body">
            <div class="pw-section">
              <div class="pw-section-hd">
                <div class="pw-section-title">New Temporary Password</div>
                <button class="btn btn-sm" @click="resetTempPw = generatePassword()" type="button">Regenerate</button>
              </div>
              <div class="pw-display">
                <code class="pw-code">{{ resetTempPw }}</code>
                <button class="icon-btn-sm" @click="copyPw(resetTempPw)" type="button">
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                    <rect x="4.5" y="4.5" width="7" height="7" rx="1" stroke="#64748B" stroke-width="1.2" />
                    <path d="M8.5 4.5V2.5a1 1 0 00-1-1h-5a1 1 0 00-1 1v5a1 1 0 001 1h2" stroke="#64748B"
                      stroke-width="1.2" stroke-linecap="round" />
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

    <!-- ── SUCCESS TOAST ── -->
    <transition name="toast-slide">
      <div v-if="toast.show" :class="['toast', `toast-${toast.type}`]">
        <svg v-if="toast.type === 'success'" width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="7" stroke="#22C55E" stroke-width="1.5" />
          <path d="M5 8l2 2 4-4" stroke="#22C55E" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        {{ toast.msg }}
      </div>
    </transition>

  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { usersApi } from '@/services/api'

const search = ref('')
const showModal = ref(false)
const showResetModal = ref(false)
const editingUser = ref(null)
const resetTarget = ref(null)
const resetTempPw = ref('')
const saving = ref(false)
const loading = ref(false)
const copied = ref(false)
const showPw = ref({})
const toast = ref({ show: false, msg: '', type: 'success' })
const users = ref([])

// ── Load users from Google Sheets on mount ──
onMounted(async () => {
  loading.value = true
  try {
    const result = await usersApi.list()
    users.value = (result.items ?? result ?? []).map(mapUser)
  } catch (e) {
    console.warn('[Users] Could not load from Sheets:', e.message)
    showToast('Could not load users from database.', 'error')
  } finally {
    loading.value = false
  }
})

// ── Map Sheets row → display object ──
function mapUser(row) {
  const colors = ['#3B82F6', '#22C55E', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#0D2137', '#1e3f61', '#27AE60', '#E9A840', '#EB5757']
  const name = row.fullName || `${row.firstName || ''} ${row.lastName || ''}`.trim() || row.email
  return {
    id: row.id,
    uid: row.uid || '',
    initials: name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase(),
    name,
    firstName: row.firstName || '',
    lastName:  row.lastName  || '',
    email: row.email || '',
    role: row.role || 'Staff',
    division: row.divisionName || row.divisionId || '',
    divisionId: row.divisionId || '',
    position: row.position || '',
    employeeNo: row.employeeNo || '',
    type: row.type || 'Regular',
    status: row.active === false || row.active === 'false' ? 'Inactive' : 'Active',
    lastLogin: row.lastLoginAt ? formatDate(row.lastLoginAt) : 'Never',
    tempPassword: row.tempPassword || '',
    avatarColor: colors[Math.abs(hashStr(row.email)) % colors.length]
  }
}

function hashStr(s) {
  return (s || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0)
}

function formatDate(iso) {
  if (!iso) return 'Never'
  const d = new Date(iso)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) return 'Today'
  return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
}

// ── Password generator ──
function generatePassword() {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const lower = 'abcdefghjkmnpqrstuvwxyz'
  const digits = '23456789'
  const special = '@#$%'
  const all = upper + lower + digits + special
  let pw = ''
  pw += upper[Math.floor(Math.random() * upper.length)]
  pw += lower[Math.floor(Math.random() * lower.length)]
  pw += digits[Math.floor(Math.random() * digits.length)]
  pw += special[Math.floor(Math.random() * special.length)]
  for (let i = 0; i < 6; i++) pw += all[Math.floor(Math.random() * all.length)]
  return pw.split('').sort(() => Math.random() - 0.5).join('')
}

// ── Form ──
const defaultForm = () => ({
  firstName: '', lastName: '', email: '',
  role: '', division: '', position: '',
  employeeNo: '', type: 'Regular',
  tempPassword: generatePassword()
})

const form = ref(defaultForm())
function regeneratePassword() { form.value.tempPassword = generatePassword() }

// ── Computed ──
const filteredUsers = computed(() => {
  const q = search.value.toLowerCase()
  if (!q) return users.value
  return users.value.filter(u =>
    u.name.toLowerCase().includes(q) ||
    u.email.toLowerCase().includes(q) ||
    u.role.toLowerCase().includes(q) ||
    (u.division || '').toLowerCase().includes(q)
  )
})

// ── Modal ──
function openAddModal() {
  editingUser.value = null
  form.value = defaultForm()
  showModal.value = true
}

function openEditModal(user) {
  editingUser.value = user
  form.value = {
    firstName: user.firstName || user.name.split(' ')[0] || '',
    lastName:  user.lastName  || user.name.split(' ').slice(1).join(' ') || '',
    email: user.email,
    role: user.role,
    division: user.division,
    position: user.position || '',
    employeeNo: user.employeeNo || '',
    type: user.type || 'Regular',
    tempPassword: ''
  }
  showModal.value = true
}

function closeModal() { showModal.value = false }

// ── Save to Google Sheets ──
async function saveUser() {
  if (!form.value.firstName || !form.value.lastName || !form.value.email || !form.value.role) {
    showToast('Please fill in all required fields.', 'error')
    return
  }
  saving.value = true
  try {
    if (editingUser.value) {
      // UPDATE in Sheets
      const updated = await usersApi.update(editingUser.value.id, {
        fullName: `${form.value.firstName} ${form.value.lastName}`,
        firstName: form.value.firstName,
        lastName: form.value.lastName,
        email: form.value.email,
        role: form.value.role,
        divisionName: form.value.division,
        position: form.value.position,
        employeeNo: form.value.employeeNo,
        type: form.value.type
      })
      const idx = users.value.findIndex(u => u.id === editingUser.value.id)
      if (idx !== -1) users.value[idx] = mapUser(updated)
      showToast('User updated successfully.')
    } else {
      // CREATE in Sheets
      const newUser = await usersApi.create({
        fullName: `${form.value.firstName} ${form.value.lastName}`,
        firstName: form.value.firstName,
        lastName: form.value.lastName,
        email: form.value.email,
        role: form.value.role,
        division: form.value.division,
        divisionName: form.value.division,
        position: form.value.position,
        employeeNo: form.value.employeeNo,
        type: form.value.type,
        tempPassword: form.value.tempPassword,
        mustChangePassword: true
      })
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

// ── Activate / Deactivate in Sheets ──
async function activateUser(user) {
  try {
    await usersApi.activate(user.id)
    user.status = 'Active'
    showToast(`${user.name} has been activated.`)
  } catch (e) {
    showToast(`Failed: ${e.message}`, 'error')
  }
}

async function deactivateUser(user) {
  try {
    await usersApi.deactivate(user.id)
    user.status = 'Inactive'
    showToast(`${user.name} has been deactivated.`, 'warning')
  } catch (e) {
    showToast(`Failed: ${e.message}`, 'error')
  }
}

// ── Reset password in Sheets ──
function resetPassword(user) {
  resetTarget.value = user
  resetTempPw.value = generatePassword()
  showResetModal.value = true
}

async function confirmReset() {
  try {
    await usersApi.resetPassword(resetTarget.value.id, resetTempPw.value)
    resetTarget.value.tempPassword = resetTempPw.value
    showToast(`Password reset for ${resetTarget.value.name}.`)
  } catch (e) {
    showToast(`Failed: ${e.message}`, 'error')
  } finally {
    showResetModal.value = false
  }
}

// ── Helpers ──
function togglePw(email) {
  showPw.value = { ...showPw.value, [email]: !showPw.value[email] }
}

async function copyPw(pw) {
  try {
    await navigator.clipboard.writeText(pw)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  } catch (e) { }
}

function roleBadgeClass(role) {
  const map = {
    'System Administrator': 'role-admin',
    'Director': 'role-director',
    'Asst. Director': 'role-director',
    'Assistant Bureau Director': 'role-director',
    'Division Chief': 'role-chief',
    'Staff': 'role-staff',
    'Contractor of Service': 'role-contractor'
  }
  return map[role] || 'role-staff'
}

function showToast(msg, type = 'success') {
  toast.value = { show: true, msg, type }
  setTimeout(() => { toast.value.show = false }, 3500)
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap');

* {
  box-sizing: border-box;
}

.content {
  padding: 16px 20px 20px;
  font-family: 'DM Sans', sans-serif;
  font-size: 13px;
  color: #1A2332;
}

.flex-row {
  display: flex;
  align-items: center;
}

.jc-sb {
  justify-content: space-between;
}

.gap-4 {
  gap: 4px;
}

.gap-6 {
  gap: 6px;
}

.gap-8 {
  gap: 8px;
}

.mb-12 {
  margin-bottom: 12px;
}

.text-xs {
  font-size: 10px;
}

.muted {
  color: #718096;
}

.fw-500 {
  font-weight: 500;
}

/* Search */
.search-box {
  display: flex;
  align-items: center;
  gap: 6px;
  background: #fff;
  border: 1px solid #E2E8F0;
  border-radius: 8px;
  padding: 7px 11px;
  transition: border-color .15s;
}

.search-box:focus-within {
  border-color: #3B82F6;
}

.search-box input {
  border: none;
  background: transparent;
  font-size: 12px;
  color: #0F172A;
  width: 200px;
  outline: none;
  font-family: 'DM Sans', sans-serif;
}

.search-box input::placeholder {
  color: #CBD5E1;
}

/* Buttons */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 7px 12px;
  border-radius: 7px;
  font-size: 12px;
  cursor: pointer;
  border: 1px solid #E2E8F0;
  background: #fff;
  color: #4A5568;
  transition: all .15s;
  font-family: 'DM Sans', sans-serif;
}

.btn:hover {
  background: #F7FAFC;
  border-color: #3B82F6;
  color: #3B82F6;
}

.btn-primary {
  background: #2563EB;
  color: #fff;
  border-color: #2563EB;
}

.btn-primary:hover {
  background: #1D4ED8;
  border-color: #1D4ED8;
  color: #fff;
}

.btn-primary:disabled {
  opacity: .6;
  cursor: not-allowed;
}

.btn-sm {
  padding: 4px 9px;
  font-size: 11px;
}

.btn-xs {
  padding: 3px 8px;
  font-size: 10px;
}

.btn-xs.activate {
  border-color: #22C55E;
  color: #15803D;
}

.btn-xs.activate:hover {
  background: #F0FDF4;
}

.btn-xs.deactivate {
  border-color: #EF4444;
  color: #B91C1C;
}

.btn-xs.deactivate:hover {
  background: #FEF2F2;
}

/* Icon buttons */
.icon-btn-sm {
  width: 24px;
  height: 24px;
  border-radius: 5px;
  border: 1px solid #E2E8F0;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all .15s;
}

.icon-btn-sm:hover {
  background: #F1F5F9;
  border-color: #CBD5E1;
}

.icon-btn-sm.danger:hover {
  background: #FEF2F2;
  border-color: #FECACA;
}

/* Card */
.card {
  background: #fff;
  border: 1px solid #E2E8F0;
  border-radius: 12px;
  overflow: hidden;
}

.card-hd {
  padding: 12px 16px;
  border-bottom: 1px solid #E2E8F0;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.card-title {
  font-size: 13px;
  font-weight: 600;
  color: #0F172A;
}

.badge {
  display: inline-flex;
  padding: 2px 8px;
  border-radius: 20px;
  font-size: 10px;
  font-weight: 500;
}

.badge-blue {
  background: #EBF4FF;
  color: #1A56B0;
}

/* Table */
.table-wrap {
  overflow-x: auto;
}

.tbl {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.tbl th {
  padding: 9px 14px;
  text-align: left;
  color: #718096;
  font-weight: 500;
  border-bottom: 1px solid #E2E8F0;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: .4px;
  background: #F8FAFC;
  white-space: nowrap;
}

.tbl td {
  padding: 11px 14px;
  border-bottom: 1px solid #F1F5F9;
  vertical-align: middle;
}

.tbl tr:last-child td {
  border-bottom: none;
}

.tbl tr:hover td {
  background: #FAFAFA;
}

.stripe td {
  background: rgba(59, 130, 246, .02);
}

.empty-row {
  text-align: center;
  color: #94A3B8;
  padding: 32px !important;
}

/* Avatar */
.av {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 700;
  color: #fff;
  flex-shrink: 0;
}

/* Role badges */
.role-badge {
  display: inline-flex;
  padding: 2px 8px;
  border-radius: 20px;
  font-size: 10px;
  font-weight: 600;
}

.role-admin {
  background: #F3EEFF;
  color: #6B3FA0;
}

.role-director {
  background: #EBF4FF;
  color: #1A56B0;
}

.role-chief {
  background: #E6F4EA;
  color: #1E7E34;
}

.role-staff {
  background: #F0F4F8;
  color: #4A5568;
}

.role-contractor {
  background: #FEF3E2;
  color: #B35A0F;
}

/* Status */
.status-badge {
  display: inline-flex;
  padding: 2px 8px;
  border-radius: 20px;
  font-size: 10px;
  font-weight: 500;
}

.s-green {
  background: #F0FDF4;
  color: #15803D;
}

.s-red {
  background: #FEF2F2;
  color: #B91C1C;
}

.s-orange {
  background: #FFFBEB;
  color: #B45309;
}

/* Temp password */
.temp-pw {
  font-family: 'DM Mono', monospace;
  font-size: 11px;
  color: #0F172A;
  background: #F1F5F9;
  padding: 3px 7px;
  border-radius: 5px;
  letter-spacing: .5px;
}

/* ── MODAL ── */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, .45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
  padding: 16px;
  backdrop-filter: blur(4px);
}

.modal {
  background: #fff;
  border-radius: 14px;
  width: 100%;
  max-width: 580px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, .18);
  overflow: hidden;
}

.modal-sm {
  max-width: 420px;
}

.modal-hd {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 20px 24px 16px;
  border-bottom: 1px solid #F1F5F9;
}

.modal-title {
  font-size: 15px;
  font-weight: 700;
  color: #0F172A;
  margin-bottom: 2px;
}

.modal-sub {
  font-size: 12px;
  color: #94A3B8;
}

.modal-close {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
  color: #94A3B8;
  transition: all .15s;
  flex-shrink: 0;
}

.modal-close:hover {
  background: #F1F5F9;
  color: #64748B;
}

.modal-body {
  padding: 20px 24px;
  max-height: 70vh;
  overflow-y: auto;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 14px 24px;
  border-top: 1px solid #F1F5F9;
  background: #F8FAFC;
}

/* Form grid */
.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  margin-bottom: 20px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.field.full {
  grid-column: span 2;
}

.field-label {
  font-size: 11px;
  font-weight: 600;
  color: #374151;
}

.req {
  color: #EF4444;
}

.field-input {
  padding: 8px 11px;
  border: 1.5px solid #E2E8F0;
  border-radius: 8px;
  font-size: 13px;
  font-family: 'DM Sans', sans-serif;
  color: #0F172A;
  outline: none;
  transition: border-color .15s;
}

.field-input:focus {
  border-color: #3B82F6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, .1);
}

.field-input::placeholder {
  color: #CBD5E1;
}

.field-select {
  padding: 8px 11px;
  border: 1.5px solid #E2E8F0;
  border-radius: 8px;
  font-size: 13px;
  font-family: 'DM Sans', sans-serif;
  color: #0F172A;
  background: #fff;
  outline: none;
  cursor: pointer;
  transition: border-color .15s;
}

.field-select:focus {
  border-color: #3B82F6;
}

/* Password section */
.pw-section {
  background: #F8FAFC;
  border: 1px solid #E2E8F0;
  border-radius: 10px;
  padding: 14px;
}

.pw-section-hd {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.pw-section-title {
  font-size: 12px;
  font-weight: 600;
  color: #0F172A;
}

.pw-section-sub {
  font-size: 10px;
  color: #94A3B8;
  margin-top: 1px;
}

.pw-display {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.pw-code {
  font-family: 'DM Mono', monospace;
  font-size: 16px;
  font-weight: 500;
  color: #1D4ED8;
  background: #EFF6FF;
  padding: 8px 14px;
  border-radius: 8px;
  letter-spacing: 1px;
  flex: 1;
  text-align: center;
  border: 1px dashed #BFDBFE;
}

.copied-tag {
  font-size: 10px;
  color: #22C55E;
  font-weight: 600;
}

.pw-note {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  font-size: 11px;
  color: #78716C;
  line-height: 1.5;
}

/* Spinner */
.spinner-sm {
  width: 13px;
  height: 13px;
  border: 1.5px solid rgba(255, 255, 255, .3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin .6s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* Toast */
.toast {
  position: fixed;
  bottom: 24px;
  right: 24px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: #fff;
  border-radius: 10px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, .12);
  border: 1px solid #E2E8F0;
  font-size: 13px;
  color: #0F172A;
  z-index: 300;
  max-width: 360px;
}

.toast-success {
  border-left: 3px solid #22C55E;
}

.toast-error {
  border-left: 3px solid #EF4444;
}

.toast-warning {
  border-left: 3px solid #F59E0B;
}

/* Transitions */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: all .2s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
  transform: scale(.96) translateY(8px);
}

.toast-slide-enter-active,
.toast-slide-leave-active {
  transition: all .25s ease;
}

.toast-slide-enter-from,
.toast-slide-leave-to {
  opacity: 0;
  transform: translateY(12px);
}
</style>