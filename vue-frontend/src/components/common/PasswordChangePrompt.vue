<template>
  <transition name="modal-fade">
    <div v-if="show" class="overlay">
      <div class="modal">

        <!-- Header -->
        <div class="modal-hd">
          <div class="lock-icon">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <rect x="5" y="13" width="18" height="12" rx="3" stroke="#2563EB" stroke-width="1.8"/>
              <path d="M9 13V9a5 5 0 0110 0v4" stroke="#2563EB" stroke-width="1.8" stroke-linecap="round"/>
              <circle cx="14" cy="19" r="1.5" fill="#2563EB"/>
              <path d="M14 20.5v2" stroke="#2563EB" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </div>
          <div>
            <h2 class="modal-title">Change Your Password</h2>
            <p class="modal-sub">You're using a temporary password. Please create a new secure password to continue.</p>
          </div>
        </div>

        <!-- Body -->
        <div class="modal-body">

          <!-- Error -->
          <div v-if="error" class="error-box">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="6" stroke="#EF4444" stroke-width="1.3"/>
              <path d="M7 4.5v3M7 9.5v.5" stroke="#EF4444" stroke-width="1.3" stroke-linecap="round"/>
            </svg>
            {{ error }}
          </div>

          <div class="field">
            <label class="field-label">New Password</label>
            <div class="input-wrap">
              <input
                v-model="newPw"
                :type="showNew ? 'text' : 'password'"
                class="field-input"
                placeholder="Enter new password"
                autocomplete="new-password"
                @input="checkStrength"
              />
              <button type="button" class="pw-toggle" @click="showNew = !showNew">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M1 7s2.5-5 6-5 6 5 6 5-2.5 5-6 5-6-5-6-5z" stroke="#94A3B8" stroke-width="1.3"/>
                  <circle cx="7" cy="7" r="2" stroke="#94A3B8" stroke-width="1.3"/>
                </svg>
              </button>
            </div>
            <!-- Strength meter -->
            <div v-if="newPw" class="strength-wrap">
              <div class="strength-bars">
                <div v-for="i in 4" :key="i" class="strength-bar" :class="strengthClass(i)"></div>
              </div>
              <span class="strength-label" :class="strengthColor">{{ strengthLabel }}</span>
            </div>
            <!-- Requirements -->
            <div class="req-list">
              <div v-for="r in requirements" :key="r.label" :class="['req-item', r.met ? 'met' : '']">
                <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                  <circle cx="5.5" cy="5.5" r="5" :stroke="r.met ? '#22C55E' : '#CBD5E1'" stroke-width="1.2"/>
                  <path v-if="r.met" d="M3 5.5l1.5 1.5 3-3" stroke="#22C55E" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                {{ r.label }}
              </div>
            </div>
          </div>

          <div class="field">
            <label class="field-label">Confirm New Password</label>
            <div class="input-wrap">
              <input
                v-model="confirmPw"
                :type="showConfirm ? 'text' : 'password'"
                class="field-input"
                :class="{ 'input-mismatch': confirmPw && newPw !== confirmPw }"
                placeholder="Re-enter new password"
                autocomplete="new-password"
              />
              <button type="button" class="pw-toggle" @click="showConfirm = !showConfirm">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M1 7s2.5-5 6-5 6 5 6 5-2.5 5-6 5-6-5-6-5z" stroke="#94A3B8" stroke-width="1.3"/>
                  <circle cx="7" cy="7" r="2" stroke="#94A3B8" stroke-width="1.3"/>
                </svg>
              </button>
            </div>
            <div v-if="confirmPw && newPw !== confirmPw" class="mismatch-msg">Passwords do not match.</div>
          </div>

        </div>

        <!-- Footer -->
        <div class="modal-footer">
          <button v-if="!props.force" class="btn-skip" @click="$emit('skip')">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M2 6.5h9M8 3.5l3 3-3 3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Skip for now
          </button>
          <!--
            This modal is force-blocking (no Skip) when a password change is
            required, and its own recent-login error tells the user to sign out
            and back in - but with Skip hidden and no other control, there was
            no way to actually do that. A user who hit that specific error was
            simply stuck behind an overlay with no path forward short of
            leaving the app by typing a URL directly. Sign Out is always a safe
            exit from a forced prompt, so it's offered here rather than only
            in the unreachable sidebar.
          -->
          <button v-if="props.force" class="btn-skip" :disabled="signingOut" @click="handleSignOut">
            <span v-if="signingOut" class="spinner"></span>
            <svg v-else width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M5 1.5H2.5a1 1 0 00-1 1v9a1 1 0 001 1H5M9 9.5l3-3-3-3M12 6.5H5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            {{ signingOut ? 'Signing out…' : 'Sign Out' }}
          </button>
          <button
            class="btn-save"
            :disabled="!canSave || saving"
            @click="handleSave"
          >
            <span v-if="saving" class="spinner"></span>
            <svg v-else width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="2" y="7" width="10" height="5" rx="1.5" stroke="white" stroke-width="1.3"/>
              <path d="M5 7V5a2.5 2.5 0 015 0v2" stroke="white" stroke-width="1.3" stroke-linecap="round"/>
            </svg>
            {{ saving ? 'Saving…' : 'Change Password' }}
          </button>
        </div>

        <!-- Skip warning -->
        <div v-if="!props.force" class="skip-warning">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M6 1L1 11h10L6 1z" stroke="#F59E0B" stroke-width="1.1" stroke-linejoin="round"/>
            <path d="M6 5v2.5M6 9v.1" stroke="#F59E0B" stroke-width="1.1" stroke-linecap="round"/>
          </svg>
          You can change your password later in Profile → Settings.
        </div>

      </div>
    </div>
  </transition>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { updatePassword } from 'firebase/auth'
import { auth } from '@/firebase'
import { usersApi } from '@/services/api'
import { useAuthStore } from '@/stores/auth'

const props = defineProps({ show: Boolean, force: Boolean })
const emit  = defineEmits(['changed', 'skip'])
const authStore = useAuthStore()
const router = useRouter()

const newPw     = ref('')
const confirmPw = ref('')
const showNew   = ref(false)
const showConfirm = ref(false)
const saving    = ref(false)
const signingOut = ref(false)
const error     = ref('')
const strength  = ref(0)

async function handleSignOut() {
  signingOut.value = true
  try {
    await authStore.logout()
    router.push('/auth/login')
  } catch (e) {
    error.value = e.message || 'Could not sign out. Please close this tab and reopen the app.'
    signingOut.value = false
  }
}

const requirements = computed(() => [
  { label: 'At least 8 characters',         met: newPw.value.length >= 8 },
  { label: 'One uppercase letter (A-Z)',     met: /[A-Z]/.test(newPw.value) },
  { label: 'One number (0-9)',               met: /[0-9]/.test(newPw.value) },
  { label: 'One special character (@#$%!)', met: /[@#$%!^&*]/.test(newPw.value) }
])

function checkStrength() {
  strength.value = requirements.value.filter(r => r.met).length
}

const strengthLabel = computed(() => {
  if (strength.value <= 1) return 'Weak'
  if (strength.value === 2) return 'Fair'
  if (strength.value === 3) return 'Good'
  return 'Strong'
})

const strengthColor = computed(() => {
  if (strength.value <= 1) return 'clr-red'
  if (strength.value === 2) return 'clr-orange'
  if (strength.value === 3) return 'clr-blue'
  return 'clr-green'
})

function strengthClass(i) {
  if (i > strength.value) return 'bar-empty'
  if (strength.value <= 1) return 'bar-red'
  if (strength.value === 2) return 'bar-orange'
  if (strength.value === 3) return 'bar-blue'
  return 'bar-green'
}

const canSave = computed(() =>
  requirements.value.every(r => r.met) && newPw.value === confirmPw.value
)

async function handleSave() {
  error.value = ''
  if (!canSave.value) return
  saving.value = true
  try {
    if (!auth.currentUser) {
      throw new Error('Your login session was not found. Please sign in again.')
    }
    await updatePassword(auth.currentUser, newPw.value)
    await usersApi.update(authStore.profileId, {
      tempPassword: '',
      mustChangePassword: false
    })
    authStore.patchProfile({ mustChangePassword: false })
    emit('changed')
  } catch (e) {
    error.value = e.code === 'auth/requires-recent-login'
      ? 'For security, please sign out and sign in again using your temporary password, then change it immediately.'
      : (e.message || 'Failed to update password. Please try again.')
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
* { box-sizing: border-box; margin: 0; padding: 0; }

.overlay {
  position: fixed; inset: 0;
  background: rgba(15,23,42,.55);
  display: flex; align-items: center; justify-content: center;
  z-index: 500; padding: 16px;
  backdrop-filter: blur(6px);
 
}

.modal {
  background: #fff; border-radius: 16px;
  width: 100%; max-width: 440px;
  box-shadow: 0 24px 80px rgba(0,0,0,.2);
  overflow: hidden;
}

.modal-hd {
  display: flex; align-items: flex-start; gap: 14px;
  padding: 24px 24px 20px;
  background: linear-gradient(135deg, #EFF6FF, #F0FDF4);
  border-bottom: 1px solid #E2E8F0;
}

.lock-icon {
  width: 52px; height: 52px; border-radius: 12px;
  background: #fff; border: 1px solid #BFDBFE;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 2px 8px rgba(37,99,235,.1);
}

.modal-title { font-size: 16px; font-weight: 700; color: #0F172A; margin-bottom: 4px; }
.modal-sub   { font-size: 12px; color: #64748B; line-height: 1.5; }

.modal-body { padding: 20px 24px; display: flex; flex-direction: column; gap: 16px; }

.error-box {
  display: flex; align-items: center; gap: 7px;
  padding: 10px 12px;
  background: #FEF2F2; border: 1px solid #FECACA;
  border-radius: 8px; font-size: 12px; color: #B91C1C;
}

.field { display: flex; flex-direction: column; gap: 6px; }
.field-label { font-size: 12px; font-weight: 600; color: #374151; }

.input-wrap { position: relative; display: flex; align-items: center; }

.field-input {
  width: 100%; padding: 10px 38px 10px 12px;
  border: 1.5px solid #E2E8F0; border-radius: 9px;
  font-size: 14px;
  color: #0F172A; outline: none;
  transition: border-color .15s, box-shadow .15s;
}
.field-input:focus { border-color: #2563EB; box-shadow: 0 0 0 3px rgba(37,99,235,.1); }
.field-input::placeholder { color: #CBD5E1; }
.input-mismatch { border-color: #EF4444 !important; }

.pw-toggle {
  position: absolute; right: 10px;
  background: none; border: none; cursor: pointer;
  display: flex; align-items: center; padding: 2px;
}

.mismatch-msg { font-size: 11px; color: #EF4444; }

/* Strength */
.strength-wrap { display: flex; align-items: center; gap: 8px; margin-top: 4px; }
.strength-bars { display: flex; gap: 3px; }
.strength-bar  { width: 32px; height: 4px; border-radius: 2px; transition: background .2s; }
.bar-empty  { background: #E2E8F0; }
.bar-red    { background: #EF4444; }
.bar-orange { background: #F59E0B; }
.bar-blue   { background: #3B82F6; }
.bar-green  { background: #22C55E; }
.strength-label { font-size: 11px; font-weight: 600; }
.clr-red    { color: #EF4444; }
.clr-orange { color: #F59E0B; }
.clr-blue   { color: #3B82F6; }
.clr-green  { color: #22C55E; }

/* Requirements */
.req-list { display: flex; flex-direction: column; gap: 4px; margin-top: 6px; }
.req-item {
  display: flex; align-items: center; gap: 6px;
  font-size: 11px; color: #94A3B8; transition: color .15s;
}
.req-item.met { color: #374151; }

/* Footer */
.modal-footer {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 24px; border-top: 1px solid #F1F5F9;
}

.btn-skip {
  display: flex; align-items: center; gap: 5px;
  background: none; border: none; cursor: pointer;
  font-size: 12px; color: #94A3B8;
  padding: 6px 4px; transition: color .15s;
}
.btn-skip:hover { color: #64748B; }

.btn-save {
  display: flex; align-items: center; gap: 7px;
  padding: 10px 18px;
  background: #2563EB; color: #fff;
  border: none; border-radius: 9px;
  font-size: 13px; font-weight: 600;
 
  cursor: pointer; transition: all .15s;
  box-shadow: 0 3px 10px rgba(37,99,235,.3);
}
.btn-save:hover:not(:disabled) { background: #1D4ED8; }
.btn-save:disabled { opacity: .5; cursor: not-allowed; }

.skip-warning {
  display: flex; align-items: center; gap: 6px;
  padding: 10px 24px 14px;
  font-size: 11px; color: #92400E;
  background: #FFFBEB; border-top: 1px solid #FDE68A;
}

.spinner {
  width: 13px; height: 13px;
  border: 1.5px solid rgba(255,255,255,.3);
  border-top-color: #fff; border-radius: 50%;
  animation: spin .6s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.modal-fade-enter-active, .modal-fade-leave-active { transition: all .25s ease; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; transform: scale(.95) translateY(10px); }
</style>
