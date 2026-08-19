<template>
  <div class="pd-root">
    <div class="pd-bg" aria-hidden="true"></div>
    <div class="pd-shell">
      <div class="pd-hero">
        <div class="pd-kicker">DSWD INNOVATION CLUSTER</div>
        <h1 class="pd-hero-title">Performance Management and Evaluation System</h1>
      </div>

      <div class="pd-card">
        <div class="pd-icon">
          <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
            <circle cx="15" cy="15" r="13" stroke="#D97706" stroke-width="2"/>
            <path d="M15 8v7l4.5 2.5" stroke="#D97706" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>

        <h2 class="pd-h2">Your account is under review</h2>
        <p class="pd-msg">
          Thanks, <strong>{{ name }}</strong> - your registration has been submitted and is
          <strong>awaiting activation</strong> by a system administrator. You'll be able to sign in
          once your account is approved.
        </p>

        <div class="pd-detail">
          <div class="pd-row"><span>Account</span><span>{{ email }}</span></div>
          <div class="pd-row"><span>Status</span><span class="pd-badge">Pending activation</span></div>
        </div>

        <p class="pd-hint">Please contact your STB system administrator to activate your access.</p>

        <transition name="ob-fade">
          <div v-if="notice" class="pd-notice">{{ notice }}</div>
        </transition>

        <div class="pd-actions">
          <button class="pd-btn pd-btn-ghost" @click="recheck" :disabled="checking">
            <span v-if="checking" class="ob-spin ob-spin-dark"></span>
            {{ checking ? 'Checking…' : 'I\'ve been approved - check again' }}
          </button>
          <button class="pd-btn pd-btn-solid" @click="signOut" :disabled="checking">Sign out</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const name  = computed(() => authStore.profile?.fullName || authStore.identity.name || 'there')
const email = computed(() => authStore.profile?.email || authStore.identity.email || '')
const checking = ref(false)
const notice = ref('')

async function recheck() {
  checking.value = true
  notice.value = ''
  try {
    await authStore.fetchProfile()
    if (authStore.hasAccess) {
      router.push('/dashboard')
    } else if (authStore.needsRegistration) {
      router.push('/auth/register')
    } else {
      notice.value = 'Still pending - your account hasn\'t been activated yet.'
    }
  } catch {
    notice.value = 'Could not check right now. Please try again in a moment.'
  } finally {
    checking.value = false
  }
}

async function signOut() {
  await authStore.logout()
  router.push('/auth/login')
}
</script>

<style scoped>
*{box-sizing:border-box;}
.pd-root{position:fixed;inset:0;overflow-y:auto;display:flex;align-items:center;justify-content:center;padding:40px 16px;}
.pd-bg{position:fixed;inset:0;z-index:0;background:#0A1526;
  background-image:radial-gradient(1200px 600px at 20% -10%,#12315F 0%,transparent 55%),radial-gradient(900px 500px at 110% 10%,#2A1A46 0%,transparent 50%),linear-gradient(160deg,#0C1E3C,#0A1220 60%,#140C26);}
.pd-shell{position:relative;z-index:1;width:100%;max-width:460px;}

.pd-hero{text-align:center;margin-bottom:18px;}
.pd-kicker{max-width:min(92vw,720px);margin:0 auto 7px;font-size:10px;font-weight:800;line-height:1.35;letter-spacing:.08em;color:#8FB2E8;}
.pd-hero-title{font-size:16px;font-weight:800;color:#EAF1FB;letter-spacing:-.2px;margin:0;}

.pd-card{background:#fff;border-radius:18px;padding:30px 26px;text-align:center;box-shadow:0 30px 80px rgba(2,8,24,.55);}
.pd-icon{width:60px;height:60px;border-radius:50%;background:#FFFBEB;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;}
.pd-h2{font-size:20px;font-weight:800;color:#0F172A;margin:0 0 10px;letter-spacing:-.3px;}
.pd-msg{font-size:13px;color:#64748B;line-height:1.65;margin:0 0 18px;}
.pd-msg strong{color:#334155;}

.pd-detail{background:#F8FAFC;border:1px solid #E8EEF7;border-radius:12px;overflow:hidden;text-align:left;margin-bottom:16px;}
.pd-row{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;font-size:12.5px;border-bottom:1px solid #F1F5F9;}
.pd-row:last-child{border-bottom:none;}
.pd-row span:first-child{color:#94A3B8;font-weight:600;}
.pd-row span:last-child{color:#0F172A;font-weight:600;}
.pd-badge{background:#FEF3E2;color:#B45309;border-radius:20px;padding:3px 10px;font-size:11px;font-weight:700;}

.pd-hint{font-size:12px;color:#94A3B8;margin:0 0 16px;}
.pd-notice{background:#EFF5FF;border:1px solid #D5E4FB;color:#1E40AF;border-radius:10px;padding:9px 12px;font-size:12px;margin-bottom:14px;}

.pd-actions{display:flex;flex-direction:column;gap:9px;}
.pd-btn{width:100%;padding:11px;border-radius:11px;font-size:13px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:7px;transition:all .15s;}
.pd-btn-ghost{background:#fff;border:1.5px solid #E2E8F0;color:#334155;}
.pd-btn-ghost:hover:not(:disabled){border-color:#93C5FD;background:#F5F9FF;color:#1A56B0;}
.pd-btn-solid{background:#0D2137;border:1px solid #0D2137;color:#fff;}
.pd-btn-solid:hover:not(:disabled){background:#1e3f61;}
.pd-btn:disabled{opacity:.55;cursor:not-allowed;}

.ob-spin{width:14px;height:14px;border:2px solid rgba(255,255,255,.35);border-top-color:#fff;border-radius:50%;animation:ob-spin .6s linear infinite;}
.ob-spin-dark{border-color:rgba(26,86,176,.25);border-top-color:#1A56B0;}
@keyframes ob-spin{to{transform:rotate(360deg)}}
.ob-fade-enter-active,.ob-fade-leave-active{transition:opacity .2s;}
.ob-fade-enter-from,.ob-fade-leave-to{opacity:0;}
</style>
