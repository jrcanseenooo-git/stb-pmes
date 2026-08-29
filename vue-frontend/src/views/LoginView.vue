<template>
  <div class="login-root">
    <div class="bg-texture" aria-hidden="true"></div>
    <div class="ambient-panels" aria-hidden="true">
      <div class="ambient-card card-a">
        <span></span><span></span><span></span>
      </div>
      <div class="ambient-card card-b">
        <span></span><span></span><span></span>
      </div>
      <div class="ambient-card card-c">
        <span></span><span></span><span></span>
      </div>
      <div class="orbit-ring ring-a"></div>
      <div class="orbit-ring ring-b"></div>
      <div class="route-node node-a"></div>
      <div class="route-node node-b"></div>
      <div class="status-chip chip-a">Behavior shapes performance</div>
      <div class="status-chip chip-b">Competence in action</div>
    </div>

    <!-- Center stage -->
    <main class="stage">

      <div class="hero-block">
        <div class="system-kicker">DSWD INNOVATION CLUSTER</div>
        <!-- Pre-authentication the office is unknown, so the sign-in pages carry
             the neutral cluster-wide name. The office-specific portal title and
             subtitle resolve from the profile once the user is signed in. -->
        <h1 class="login-title">
          <span>Performance Management</span>
          <span>and Evaluation System</span>
        </h1>
        <p class="login-title-sub">Accountability, Accomplishments, and Performance Evaluation</p>
      </div>

      <div class="form-shell">

        <!-- Heading -->
        <div class="form-heading">
          <h2>Welcome back</h2>
          <p>Sign in with your <strong>{{ domain }}</strong> account to continue</p>
        </div>

        <!-- Error -->
        <transition name="alert-in">
          <div v-if="error" class="alert-error" role="alert">
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" style="flex-shrink:0;margin-top:1px">
              <circle cx="7.5" cy="7.5" r="6.5" stroke="#DC2626" stroke-width="1.4"/>
              <path d="M7.5 4.5v3.5M7.5 10v.1" stroke="#DC2626" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
            <span>{{ error }}</span>
          </div>
        </transition>

        <!-- Google SSO -->
        <button class="btn-google" @click="handleGoogleLogin" :disabled="loading || googleRedirectPending" type="button">
          <span v-if="googleSigningIn" class="spin spin-dark"></span>
          <svg v-else width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M17.1 9.2c0-.65-.06-1.28-.16-1.88H9v3.56h4.58a3.93 3.93 0 01-1.7 2.57v2.14h2.75c1.6-1.48 2.53-3.65 2.53-6.38z" fill="#4285F4"/>
            <path d="M9 18c2.3 0 4.23-.76 5.63-2.06l-2.75-2.14c-.76.51-1.73.82-2.88.82-2.22 0-4.1-1.5-4.77-3.51H1.4v2.2A8.5 8.5 0 009 18z" fill="#34A853"/>
            <path d="M4.23 11.11A5.1 5.1 0 014 9.5c0-.56.1-1.1.23-1.61V5.69H1.4A8.5 8.5 0 000 9.5c0 1.37.33 2.66.91 3.81l2.2-1.72 1.12-.48z" fill="#FBBC05"/>
            <path d="M9 3.58c1.26 0 2.38.43 3.27 1.28l2.45-2.45A8.5 8.5 0 001.4 5.69l2.83 2.2C4.9 5.9 6.78 3.58 9 3.58z" fill="#EA4335"/>
          </svg>
          {{ googleSigningIn ? 'Signing in...' : 'Continue with Google' }}
        </button>

        <!-- Divider -->
        <div class="or-divider"><span>or sign in with</span></div>

        <!-- Email / Password -->
        <form @submit.prevent="handleEmailLogin" novalidate class="email-form">

          <div class="field-group">
            <label for="email" class="field-label">Email address</label>
            <div class="input-wrap">
              <svg class="input-icon" width="15" height="15" viewBox="0 0 15 15" fill="none">
                <rect x="1.5" y="3" width="12" height="9" rx="1.5" stroke="currentColor" stroke-width="1.3"/>
                <path d="M1.5 5.5l6 3.5 6-3.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
              </svg>
              <input
                id="email"
                v-model="email"
                type="email"
                placeholder="you@dswd.gov.ph"
                autocomplete="email"
                :disabled="loading"
                required
              />
            </div>
          </div>

          <div class="field-group">
            <label for="password" class="field-label">
              Password
              <a href="#" class="forgot-link" @click.prevent>Forgot password?</a>
            </label>
            <div class="input-wrap">
              <svg class="input-icon" width="15" height="15" viewBox="0 0 15 15" fill="none">
                <rect x="2.5" y="7" width="10" height="6.5" rx="1.5" stroke="currentColor" stroke-width="1.3"/>
                <path d="M5 7V5.5a2.5 2.5 0 015 0V7" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
              </svg>
              <input
                id="password"
                v-model="password"
                :type="showPw ? 'text' : 'password'"
                placeholder="Enter your password"
                autocomplete="current-password"
                :disabled="loading"
                required
              />
              <button type="button" class="pw-eye" @click="showPw = !showPw" :aria-label="showPw ? 'Hide password' : 'Show password'">
                <svg v-if="!showPw" width="15" height="15" viewBox="0 0 15 15" fill="none">
                  <path d="M1 7.5S3.5 2.5 7.5 2.5 14 7.5 14 7.5 11.5 12.5 7.5 12.5 1 7.5 1 7.5z" stroke="currentColor" stroke-width="1.3"/>
                  <circle cx="7.5" cy="7.5" r="2" stroke="currentColor" stroke-width="1.3"/>
                </svg>
                <svg v-else width="15" height="15" viewBox="0 0 15 15" fill="none">
                  <path d="M1 7.5S3.5 2.5 7.5 2.5 14 7.5 14 7.5 11.5 12.5 7.5 12.5 1 7.5 1 7.5z" stroke="currentColor" stroke-width="1.3"/>
                  <circle cx="7.5" cy="7.5" r="2" stroke="currentColor" stroke-width="1.3"/>
                  <line x1="2" y1="2" x2="13" y2="13" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
                </svg>
              </button>
            </div>
          </div>

          <button type="submit" class="btn-primary" :disabled="loading || !email || !password">
            <span v-if="loading && loginMethod === 'email'" class="spin"></span>
            <template v-else>
              Sign in
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                <path d="M2.5 7.5h10M9 4l3.5 3.5L9 11" stroke="white" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </template>
            <span v-if="loading && loginMethod === 'email'" class="btn-loading-text">Signing in…</span>
          </button>

        </form>

        <!-- Security note -->
        <div class="access-note">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style="flex-shrink:0;margin-top:1px">
            <path d="M6.5 1.5L2 3.5V6.5c0 2.76 2 5.15 4.5 5.5C9 11.65 11 9.26 11 6.5V3.5L6.5 1.5z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>
            <path d="M4.5 6.5l1.5 1.5 2.5-2.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          Access is restricted to DSWD Innovation Cluster personnel only.
        </div>

        <p class="form-footer">DSWD · Innovation Cluster · {{ currentYear }} · v2.0</p>

      </div>
    </main>

    <!-- The button's own spinner already covers this whole window (popup close
         through the account check through routing), but it is a small element
         inside a card the user's attention just left to deal with the Google
         popup - easy to come back to and not notice. This overlay makes the
         same wait impossible to miss, and covers the account-check round trip
         specifically: PMES has to confirm the signed-in Firebase user still has
         an active system profile before routing them into the app. -->
    <transition name="alert-in">
      <div v-if="googleSigningIn" class="signin-overlay" role="status" aria-live="polite">
        <div class="signin-overlay-card">
          <span class="spin-dark" style="width:22px;height:22px;border-width:2.5px;"></span>
          <p>Checking your account…</p>
          <span>Loading your PMES access</span>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const authStore   = useAuthStore()
const router      = useRouter()
const route       = useRoute()

const email       = ref('')
const password    = ref('')
const showPw      = ref(false)
const loading     = ref(false)
const loginMethod = ref('')
const error       = ref('')

const domain      = import.meta.env.VITE_ALLOWED_EMAIL_DOMAIN || 'dswd.gov.ph'
const currentYear = computed(() => new Date().getFullYear())
const GOOGLE_REDIRECT_PENDING_KEY = 'pmes.googleRedirectPending'
const googleRedirectPending = ref(sessionStorage.getItem(GOOGLE_REDIRECT_PENDING_KEY) === '1')
const googleSigningIn = computed(() =>
  googleRedirectPending.value || (loading.value && loginMethod.value === 'google')
)
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms))

const ALLOWED_REDIRECT_PATHS = new Set([
  '/dashboard',
  '/evaluation',
  '/ipcrf',
  '/accomplishments',
  '/review',
  '/reports',
  '/audit',
  '/users',
  '/office-registry',
  '/office-management',
  '/office-dashboard',
  '/profile',
  '/kra'
])

function safeRedirectTarget(value) {
  const raw = String(value || '').trim()
  if (!raw || raw.startsWith('//') || /^[a-z][a-z\d+.-]*:/i.test(raw)) return '/dashboard'

  const normalized = raw.startsWith('/') ? raw : `/${raw}`
  const basePath = normalized.split('?')[0].split('#')[0]
  return ALLOWED_REDIRECT_PATHS.has(basePath) ? normalized : '/dashboard'
}

const redirect = computed(() => safeRedirectTarget(route.query.redirect))

onMounted(async () => {
  if (googleRedirectPending.value) {
    loading.value = true
    loginMethod.value = 'google'
  }
  if (!authStore.initialised) await authStore.init()
  let routed = await routeSignedInUser()
  if (!routed && googleRedirectPending.value) {
    await wait(900)
    if (!authStore.initialised) await authStore.init()
    routed = await routeSignedInUser()
  }
  if (!routed && googleRedirectPending.value) {
    clearGoogleRedirectPending()
  }
})

async function routeSignedInUser() {
  if (!authStore.isAuthenticated) return false
  if (authStore.needsRegistration) {
    clearGoogleRedirectPending()
    await router.replace('/auth/register')
    return true
  }
  if (authStore.needsActivation) {
    clearGoogleRedirectPending()
    await router.replace('/auth/pending')
    return true
  }
  clearGoogleRedirectPending()
  await router.replace(redirect.value)
  return true
}

function clearGoogleRedirectPending() {
  sessionStorage.removeItem(GOOGLE_REDIRECT_PENDING_KEY)
  googleRedirectPending.value = false
  loading.value = false
  if (loginMethod.value === 'google') loginMethod.value = ''
}

async function handleEmailLogin() {
  error.value       = ''
  loading.value     = true
  loginMethod.value = 'email'
  try {
    await authStore.loginWithEmail(email.value, password.value)
    await routeSignedInUser()
  } catch (e) {
    error.value = e?.message || 'Sign-in failed. Please check your account and try again.'
  } finally {
    loading.value     = false
    loginMethod.value = ''
  }
}

async function handleGoogleLogin() {
  error.value       = ''
  loading.value     = true
  loginMethod.value = 'google'
  googleRedirectPending.value = true
  sessionStorage.setItem(GOOGLE_REDIRECT_PENDING_KEY, '1')
  try {
    const result = await authStore.loginWithGoogle()
    if (result?.redirected) {
      return
    }
    await routeSignedInUser()
  } catch (e) {
    if (e?.redirected) {
      googleRedirectPending.value = true
      sessionStorage.setItem(GOOGLE_REDIRECT_PENDING_KEY, '1')
      return
    }
    console.warn('[PMES] Google sign-in failed:', e?.code || e?.message)
    clearGoogleRedirectPending()
    const message = e?.message || ''
    error.value = message || 'Google sign-in failed. Please try again.'
  } finally {
    if (!googleRedirectPending.value) {
      loading.value     = false
      loginMethod.value = ''
    }
  }
}
</script>


<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Plus+Jakarta+Sans:wght@700;800&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:global(html), :global(body) {
  overflow: hidden;
  height: 100%;
}

/* ══ ROOT - fullscreen single column, colored backdrop ══ */
.login-root {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  font-family: 'Inter', system-ui, sans-serif;
  overflow: hidden;
  background:
    radial-gradient(ellipse at 18% 8%,  rgba(0,56,168,.55) 0%, transparent 52%),
    radial-gradient(ellipse at 85% 88%, rgba(206,17,38,.26) 0%, transparent 48%),
    radial-gradient(ellipse at 60% 40%, rgba(0,30,100,.38)  0%, transparent 60%),
    linear-gradient(162deg, #040c1c 0%, #081830 35%, #0c2040 65%, #0e2850 100%);
}

/* Dot-grid texture overlay (kept - this is the colored-side texture, not the white grid) */
.bg-texture {
  position: absolute;
  inset: 0;
  background-image: radial-gradient(rgba(255,255,255,.035) 1px, transparent 1px);
  background-size: 22px 22px;
  pointer-events: none;
  z-index: 0;
}

.bg-texture::after {
  content: '';
  position: absolute;
  inset: -20%;
  background:
    linear-gradient(115deg, transparent 18%, rgba(255,255,255,.045) 38%, transparent 58%),
    linear-gradient(25deg, transparent 35%, rgba(47,128,237,.06) 48%, transparent 62%);
  transform: translateX(-12%);
  animation: gridSweep 18s ease-in-out infinite alternate;
}

.ambient-panels {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 1;
  overflow: hidden;
}

.ambient-card {
  position: absolute;
  width: 164px;
  min-height: 92px;
  border: 1px solid rgba(226,232,240,.14);
  border-radius: 14px;
  background: rgba(255,255,255,.055);
  box-shadow: 0 18px 60px rgba(0,0,0,.16);
  backdrop-filter: blur(6px);
  padding: 18px 16px;
  opacity: .54;
}

.ambient-card span {
  display: block;
  height: 7px;
  border-radius: 99px;
  background: rgba(226,232,240,.42);
}

.ambient-card span + span { margin-top: 10px; }
.ambient-card span:nth-child(1) { width: 72%; background: rgba(255,255,255,.58); }
.ambient-card span:nth-child(2) { width: 100%; }
.ambient-card span:nth-child(3) { width: 48%; background: rgba(47,128,237,.48); }

.card-a {
  left: 13%;
  top: 22%;
  animation: floatPanelA 16s ease-in-out infinite;
}

.card-b {
  right: 12%;
  top: 29%;
  transform: scale(.92);
  animation: floatPanelB 19s ease-in-out infinite;
}

.card-c {
  left: 18%;
  bottom: 14%;
  transform: scale(.82);
  animation: floatPanelC 22s ease-in-out infinite;
}

.orbit-ring {
  position: absolute;
  border: 1px solid rgba(255,255,255,.08);
  border-radius: 50%;
  opacity: .46;
}

.ring-a {
  width: 360px;
  height: 360px;
  left: 9%;
  top: 13%;
  animation: pulseRing 10s ease-in-out infinite;
}

.ring-b {
  width: 430px;
  height: 430px;
  right: 5%;
  bottom: 3%;
  animation: pulseRing 13s ease-in-out infinite reverse;
}

.route-node {
  position: absolute;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: #7DB2FF;
  box-shadow: 0 0 0 7px rgba(125,178,255,.1), 0 0 24px rgba(125,178,255,.45);
  opacity: .78;
}

.node-a {
  left: 27%;
  top: 35%;
  background: #FCD116;
  box-shadow: 0 0 0 7px rgba(252,209,22,.09), 0 0 24px rgba(252,209,22,.35);
  animation: nodePathC 16s ease-in-out infinite;
}

.node-b {
  right: 27%;
  top: 43%;
  animation: nodePathB 14s ease-in-out infinite;
}

.status-chip {
  position: absolute;
  padding: 7px 12px;
  border: 1px solid rgba(226,232,240,.14);
  border-radius: 999px;
  background: rgba(255,255,255,.07);
  backdrop-filter: blur(8px);
  color: rgba(241,245,249,.76);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: .2px;
  box-shadow: 0 18px 60px rgba(0,0,0,.12);
}

.chip-a {
  right: 18%;
  top: 18%;
  animation: chipFloatA 15s ease-in-out infinite;
}

.chip-b {
  left: 16%;
  bottom: 27%;
  animation: chipFloatB 17s ease-in-out infinite;
}

@keyframes gridSweep {
  from { transform: translateX(-14%) translateY(0); opacity: .62; }
  to { transform: translateX(10%) translateY(3%); opacity: .9; }
}

@keyframes floatPanelA {
  0%,100% { transform: translate3d(0,0,0) rotate(-3deg); }
  50% { transform: translate3d(18px,-18px,0) rotate(2deg); }
}

@keyframes floatPanelB {
  0%,100% { transform: translate3d(0,0,0) scale(.92) rotate(3deg); }
  50% { transform: translate3d(-18px,16px,0) scale(.92) rotate(-2deg); }
}

@keyframes floatPanelC {
  0%,100% { transform: translate3d(0,0,0) scale(.82) rotate(2deg); }
  50% { transform: translate3d(20px,14px,0) scale(.82) rotate(-2deg); }
}

@keyframes routeDrift {
  0%,100% { transform: translateX(0); opacity: .25; }
  50% { transform: translateX(34px); opacity: .62; }
}

@keyframes pulseRing {
  0%,100% { transform: scale(.95); opacity: .2; }
  50% { transform: scale(1.04); opacity: .48; }
}

@keyframes nodePathA {
  0%,100% { transform: translate3d(0,0,0); opacity: .35; }
  40% { transform: translate3d(58px,-20px,0); opacity: .85; }
  70% { transform: translate3d(26px,34px,0); opacity: .55; }
}

@keyframes nodePathB {
  0%,100% { transform: translate3d(0,0,0); opacity: .32; }
  45% { transform: translate3d(-46px,24px,0); opacity: .78; }
  75% { transform: translate3d(-14px,-34px,0); opacity: .5; }
}

@keyframes nodePathC {
  0%,100% { transform: translate3d(0,0,0); opacity: .28; }
  50% { transform: translate3d(34px,-28px,0); opacity: .74; }
}

@keyframes chipFloatA {
  0%,100% { transform: translate3d(0,0,0); opacity: .36; }
  50% { transform: translate3d(-18px,18px,0); opacity: .7; }
}

@keyframes chipFloatB {
  0%,100% { transform: translate3d(0,0,0); opacity: .32; }
  50% { transform: translate3d(22px,-18px,0); opacity: .66; }
}

@keyframes tickFloat {
  0%,100% { transform: translate3d(0,0,0) rotate(0deg); opacity: .28; }
  50% { transform: translate3d(14px,-18px,0) rotate(4deg); opacity: .62; }
}

.seal-wrap {
  position: relative;
  width: 46px;
  height: 46px;
  flex-shrink: 0;
}

.sun-rays {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: rotateSun 30s linear infinite;
}
@keyframes rotateSun { to { transform: rotate(360deg); } }

.ray {
  position: absolute;
  width: 2px;
  height: 16px;
  background: linear-gradient(to bottom, rgba(252,209,22,.65), transparent);
  border-radius: 1px;
  top: 50%; left: 50%;
  transform-origin: 50% 0;
  transform: translateX(-50%) translateY(-100%) rotate(calc((var(--r) - 1) * 45deg));
}

.seal-circle {
  position: absolute;
  inset: 6px;
  background: rgba(255,255,255,.1);
  border: 1.5px solid rgba(255,255,255,.18);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(8px);
}

.system-kicker {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  max-width: min(92vw, 720px);
  min-height: 24px;
  padding: 4px 12px;
  margin-bottom: 12px;
  border: 1px solid rgba(255,255,255,.18);
  border-radius: 999px;
  background: rgba(255,255,255,.08);
  color: rgba(255,255,255,.82);
  font-size: 11px;
  font-weight: 800;
  line-height: 1.35;
  letter-spacing: 1px;
  text-align: center;
}

.login-title {
  display: grid;
  gap: 2px;
  margin: 0;
  font-family: 'Plus Jakarta Sans', sans-serif;
  color: #F8FAFC;
  font-size: clamp(28px, 4vw, 42px);
  line-height: .98;
  font-weight: 800;
  letter-spacing: -.9px;
  text-transform: uppercase;
  text-shadow: 0 16px 40px rgba(0,0,0,.32);
}

.login-title span:first-child {
  color: rgba(255,255,255,.72);
  font-size: .72em;
  letter-spacing: 3px;
}

.login-title-sub {
  max-width: 520px;
  margin: 14px auto 0;
  color: rgba(226,232,240,.76);
  font-size: 13px;
  line-height: 1.55;
}

/* ── Center stage ── */
.stage {
  position: relative;
  z-index: 2;
  flex: 1;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 30px;
  padding: 20px 24px 32px;
  min-height: 0;
  overflow-y: auto;
}

.hero-block {
  text-align: center;
  max-width: 620px;
}

/* ── Form shell (the card) ── */
.form-shell {
  width: 100%;
  max-width: 420px;
  background: #ffffff;
  border-radius: 20px;
  padding: 32px 36px 28px;
  box-shadow:
    0 1px 2px rgba(0,0,0,.08),
    0 8px 24px rgba(0,0,0,.18),
    0 32px 80px rgba(0,10,40,.35);
  position: relative;
  z-index: 1;
  border: 1px solid rgba(255,255,255,.06);
}

/* ── Form heading ── */
.form-heading {
  margin-bottom: 20px;
}
.form-heading h2 {
  font-family: 'Plus Jakarta Sans', sans-serif;
  font-size: 24px;
  font-weight: 800;
  color: #0A1628;
  letter-spacing: -.6px;
  margin-bottom: 6px;
  line-height: 1.15;
}
.form-heading p {
  font-size: 13px;
  color: #64748B;
  line-height: 1.5;
}
.form-heading strong {
  color: #0038A8;
  font-weight: 700;
}

/* ── Error alert ── */
.alert-error {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 14px;
  background: #FEF2F2;
  border: 1px solid #FECACA;
  border-radius: 11px;
  font-size: 13px;
  color: #991B1B;
  margin-bottom: 20px;
  line-height: 1.45;
}
.alert-in-enter-active, .alert-in-leave-active { transition: all .2s ease; }
.alert-in-enter-from, .alert-in-leave-to { opacity: 0; transform: translateY(-6px); }

/* ── Google button ── */
.btn-google {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: 100%;
  padding: 13.5px 16px;
  background: #fff;
  border: 1.5px solid #E2E8F0;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 600;
  font-family: 'Inter', sans-serif;
  color: #1E293B;
  cursor: pointer;
  transition: all .15s ease;
  box-shadow: 0 1px 3px rgba(0,0,0,.05);
}
.btn-google:hover:not(:disabled) {
  background: #F7FAFF;
  border-color: #AABFE0;
  box-shadow: 0 3px 14px rgba(0,56,168,.09);
  transform: translateY(-1px);
}
.btn-google:active:not(:disabled) { transform: none; }
.btn-google:disabled { opacity: .55; cursor: not-allowed; }

/* ── OR divider ── */
.or-divider {
  display: flex;
  align-items: center;
  gap: 11px;
  margin: 16px 0;
  font-size: 11px;
  font-weight: 600;
  color: #94A3B8;
  text-transform: uppercase;
  letter-spacing: .6px;
}
.or-divider::before, .or-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: #EDF2F8;
}

/* ── Email form ── */
.email-form {
  display: flex;
  flex-direction: column;
  gap: 13px;
}

.field-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12.5px;
  font-weight: 600;
  color: #374151;
}

.forgot-link {
  font-size: 12px;
  font-weight: 500;
  color: #0038A8;
  text-decoration: none;
  transition: color .12s;
  /* Was 103x15, under the 24x24 minimum target size (WCAG 2.5.8). The padding
     grows the hit area and the negative margin cancels its effect on the flex
     row, so the label sits exactly where it did - the target gets bigger
     without the layout moving. */
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 0 4px;
  margin: -4px;
}
.forgot-link:hover { color: #002d8a; text-decoration: underline; }

.input-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.input-icon {
  position: absolute;
  left: 13px;
  pointer-events: none;
  color: #94A3B8;
  flex-shrink: 0;
  transition: color .15s;
}

.input-wrap input {
  width: 100%;
  padding: 12.5px 42px;
  border: 1.5px solid #E5EAF2;
  border-radius: 11px;
  font-size: 14px;
  font-family: 'Inter', sans-serif;
  color: #0F172A;
  background: #FAFBFE;
  outline: none;
  transition: border-color .15s, box-shadow .15s, background .15s;
}
.input-wrap input:hover { border-color: #C2CEE8; }
.input-wrap input:focus {
  border-color: #0038A8;
  box-shadow: 0 0 0 3px rgba(0,56,168,.1);
  background: #fff;
}
.input-wrap:focus-within .input-icon { color: #0038A8; }
.input-wrap input:disabled {
  background: #F5F7FA;
  cursor: not-allowed;
  color: #94A3B8;
}
.input-wrap input::placeholder { color: #C0CAD8; }

.pw-eye {
  position: absolute;
  right: 12px;
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  color: #94A3B8;
  display: flex;
  align-items: center;
  /* Was 23x23 - a pixel under the 24x24 minimum target size (WCAG 2.5.8).
     The button is absolutely positioned inside the input, so growing the hit
     box centres the same icon without moving anything. */
  justify-content: center;
  min-width: 24px;
  min-height: 24px;
  border-radius: 5px;
  transition: color .13s;
}
.pw-eye:hover { color: #64748B; }

/* ── Primary CTA ── */
.btn-primary {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 14.5px;
  background: #0038A8;
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 14.5px;
  font-weight: 700;
  font-family: 'Inter', sans-serif;
  cursor: pointer;
  transition: all .15s ease;
  box-shadow: 0 4px 18px rgba(0,56,168,.32), 0 1px 3px rgba(0,56,168,.18);
  margin-top: 4px;
  letter-spacing: .1px;
}
.btn-primary:hover:not(:disabled) {
  background: #002880;
  box-shadow: 0 6px 26px rgba(0,56,168,.42);
  transform: translateY(-1px);
}
.btn-primary:active:not(:disabled) { transform: none; box-shadow: 0 2px 8px rgba(0,56,168,.25); }
.btn-primary:disabled { opacity: .5; cursor: not-allowed; transform: none; }
.btn-loading-text { margin-left: 4px; }

/* ── Spinners ── */
.spin {
  width: 15px; height: 15px;
  border: 2px solid rgba(255,255,255,.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin .6s linear infinite;
  flex-shrink: 0;
}
.spin-dark {
  width: 15px; height: 15px;
  border: 2px solid #E2E8F0;
  border-top-color: #374151;
  border-radius: 50%;
  animation: spin .6s linear infinite;
  flex-shrink: 0;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* ── Google sign-in overlay ── */
.signin-overlay {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: grid;
  place-items: center;
  background: rgba(9, 19, 38, .55);
  backdrop-filter: blur(2px);
}
.signin-overlay-card {
  display: grid;
  justify-items: center;
  gap: 10px;
  padding: 28px 34px;
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 20px 50px -12px rgba(0,0,0,.35);
}
.signin-overlay-card p {
  margin: 4px 0 0;
  font-size: 15px;
  font-weight: 700;
  color: #0f172a;
}
.signin-overlay-card span:last-child {
  font-size: 12.5px;
  color: #64748b;
}

/* ── Access note ── */
.access-note {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  margin-top: 14px;
  padding: 9px 12px;
  background: #F4F7FF;
  border: 1px solid #D8E4F8;
  border-radius: 10px;
  font-size: 11px;
  line-height: 1.5;
  color: #4A6FA5;
}
.access-note svg { color: #0038A8; }

/* ── Footer ── */
.form-footer {
  margin-top: 14px;
  text-align: center;
  font-size: 10.5px;
  color: #B0BAC8;
  letter-spacing: .3px;
}

/* ══ RESPONSIVE ══ */
@media (max-width: 600px) {
  :global(html), :global(body) { overflow: auto; height: auto; }
  .login-root { position: static; min-height: 100vh; height: auto; overflow: visible; }
  .stage { padding: 16px 18px 28px; gap: 22px; }
  .hero-headline { font-size: 24px; }
  .form-shell { padding: 26px 22px 22px; border-radius: 16px; }
  .ambient-card, .orbit-ring, .route-node, .status-chip { display: none; }
}

@media (prefers-reduced-motion: reduce) {
  .bg-texture::after,
  .ambient-card,
  .orbit-ring,
  .route-node,
  .status-chip,
  .sun-rays,
  .spin,
  .spin-dark {
    animation: none !important;
  }
}
</style>
