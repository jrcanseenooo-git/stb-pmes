<template>
  <div class="login-root">

    <!-- ══ LEFT PANEL ══ -->
    <aside class="left-panel">
      <div class="left-inner">

        <!-- Top: Org identity -->
        <div class="org-header">
          <div class="seal-wrap">
            <!-- Philippine Sun rays -->
            <div class="sun-rays" aria-hidden="true">
              <span v-for="i in 8" :key="i" class="ray" :style="`--r:${i}`"></span>
            </div>
            <div class="seal-circle">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <path d="M4 7h20M4 14h13M4 21h16" stroke="white" stroke-width="2.2" stroke-linecap="round"/>
                <circle cx="21" cy="20" r="5" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.4)" stroke-width="1.5"/>
                <path d="M19.2 20l1.6 1.6 3-3" stroke="white" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
          </div>
          <div class="org-text">
            <div class="org-abbr">DSWD · STB</div>
            <div class="org-full">Department of Social Welfare<br>and Development</div>
          </div>
        </div>

        <!-- Center: Hero -->
        <div class="hero-block">
          <div class="system-tag">
            <span class="tag-dot"></span>
            Performance Monitoring &amp; Evaluation System
          </div>
          <h1 class="hero-headline">
            Monitor.<br>Evaluate.<br>Deliver.
          </h1>
          <p class="hero-body">
            Unified performance tracking for the Social Technology Bureau — from KRA targets to accomplishment records, all in one place.
          </p>
        </div>

        <!-- Bottom: Metrics strip -->
        <div class="metrics-strip">
          <div class="metric">
            <span class="metric-num">IPCRF</span>
            <span class="metric-lbl">Target Tracking</span>
          </div>
          <div class="metric-div"></div>
          <div class="metric">
            <span class="metric-num">IPAT</span>
            <span class="metric-lbl">Innovation Tool</span>
          </div>
          <div class="metric-div"></div>
          <div class="metric">
            <span class="metric-num">MOV</span>
            <span class="metric-lbl">Evidence Files</span>
          </div>
        </div>

        <!-- Flag accent bar at bottom -->
        <div class="flag-bar">
          <div class="flag-seg flag-blue"></div>
          <div class="flag-seg flag-red"></div>
          <div class="flag-seg flag-gold"></div>
        </div>

      </div>
    </aside>

    <!-- ══ RIGHT PANEL ══ -->
    <main class="right-panel">

      <!-- Noise texture overlay -->
      <div class="right-texture" aria-hidden="true"></div>

      <div class="form-shell">

        <!-- Status chip -->
        <div class="status-chip">
          <span class="chip-pulse"></span>
          Secure Access Portal
        </div>

        <!-- Heading -->
        <div class="form-heading">
          <h2>Welcome back</h2>
          <p>Sign in with your <strong>{{ domain }}</strong> account to continue</p>
        </div>

        <!-- Error alert -->
        <transition name="alert-in">
          <div v-if="error" class="alert-error" role="alert">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="7" stroke="#DC2626" stroke-width="1.4"/>
              <path d="M8 4.5v4M8 10.5v.5" stroke="#DC2626" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
            <span>{{ error }}</span>
          </div>
        </transition>

        <!-- Google SSO -->
        <button class="btn-google" @click="handleGoogleLogin" :disabled="loading" type="button">
          <span v-if="loading && loginMethod === 'google'" class="spin spin-dark"></span>
          <svg v-else width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M17.1 9.2c0-.65-.06-1.28-.16-1.88H9v3.56h4.58a3.93 3.93 0 01-1.7 2.57v2.14h2.75c1.6-1.48 2.53-3.65 2.53-6.38z" fill="#4285F4"/>
            <path d="M9 18c2.3 0 4.23-.76 5.63-2.06l-2.75-2.14c-.76.51-1.73.82-2.88.82-2.22 0-4.1-1.5-4.77-3.51H1.4v2.2A8.5 8.5 0 009 18z" fill="#34A853"/>
            <path d="M4.23 11.11A5.1 5.1 0 014 9.5c0-.56.1-1.1.23-1.61V5.69H1.4A8.5 8.5 0 000 9.5c0 1.37.33 2.66.91 3.81l2.2-1.72 1.12-.48z" fill="#FBBC05"/>
            <path d="M9 3.58c1.26 0 2.38.43 3.27 1.28l2.45-2.45A8.5 8.5 0 001.4 5.69l2.83 2.2C4.9 5.9 6.78 3.58 9 3.58z" fill="#EA4335"/>
          </svg>
          {{ loading && loginMethod === 'google' ? 'Connecting…' : 'Continue with Google' }}
        </button>

        <!-- Divider -->
        <div class="or-divider"><span>or sign in with email</span></div>

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
                :class="{ 'has-value': email }"
                required
              />
            </div>
          </div>

          <div class="field-group">
            <label for="password" class="field-label">
              Password
              <a href="#" class="forgot-link">Forgot password?</a>
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

          <button
            type="submit"
            class="btn-primary"
            :disabled="loading || !email || !password"
          >
            <span v-if="loading && loginMethod === 'email'" class="spin"></span>
            <template v-else>
              Sign in
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 8h10M9.5 4.5L13 8l-3.5 3.5" stroke="white" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </template>
            <span v-if="loading && loginMethod === 'email'" style="margin-left:6px">Signing in…</span>
          </button>

        </form>

        <!-- Footer note -->
        <div class="access-note">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M6.5 1.5L2 3.5V6.5c0 2.76 2 5.15 4.5 5.5C9 11.65 11 9.26 11 6.5V3.5L6.5 1.5z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>
            <path d="M4.5 6.5l1.5 1.5 2.5-2.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          Access is restricted to authorized DSWD–STB personnel only.
        </div>

        <p class="form-footer">DSWD · Social Technology Bureau · {{ currentYear }} · v2.0</p>

      </div>
    </main>

  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
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
const redirect    = route.query.redirect || '/dashboard'
const currentYear = computed(() => new Date().getFullYear())

async function handleEmailLogin() {
  error.value       = ''
  loading.value     = true
  loginMethod.value = 'email'
  try {
    await authStore.loginWithEmail(email.value, password.value)
    router.push(redirect)
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value     = false
    loginMethod.value = ''
  }
}

async function handleGoogleLogin() {
  error.value       = ''
  loading.value     = true
  loginMethod.value = 'google'
  try {
    await authStore.loginWithGoogle()
    router.push(redirect)
  } catch (e) {
    if (!e.message.includes('popup-closed')) {
      error.value = e.message
    }
  } finally {
    loading.value     = false
    loginMethod.value = ''
  }
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Plus+Jakarta+Sans:wght@700;800&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

/* ══ ROOT ══ */
.login-root {
  display: flex;
  min-height: 100vh;
  font-family: 'Inter', system-ui, sans-serif;
}

/* ══════════════════════════════════
   LEFT PANEL
══════════════════════════════════ */
.left-panel {
  width: 420px;
  flex-shrink: 0;
  background:
    radial-gradient(ellipse at 20% 10%, rgba(0,56,168,.55) 0%, transparent 55%),
    radial-gradient(ellipse at 80% 85%, rgba(206,17,38,.25) 0%, transparent 50%),
    linear-gradient(165deg, #050d1e 0%, #0a1a35 40%, #0d2448 100%);
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.left-inner {
  position: relative;
  z-index: 2;
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 44px 40px 0;
  gap: 0;
}

/* ── Org header ── */
.org-header {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 56px;
}

.seal-wrap {
  position: relative;
  width: 52px;
  height: 52px;
  flex-shrink: 0;
}

/* Animated sun rays */
.sun-rays {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: rotateSun 24s linear infinite;
}
@keyframes rotateSun { to { transform: rotate(360deg); } }

.ray {
  position: absolute;
  width: 2px;
  height: 20px;
  background: linear-gradient(to bottom, rgba(252,209,22,.7), transparent);
  border-radius: 1px;
  top: 50%;
  left: 50%;
  transform-origin: 50% 0;
  transform: translateX(-50%) translateY(-100%) rotate(calc((var(--r) - 1) * 45deg));
}

.seal-circle {
  position: absolute;
  inset: 6px;
  background: rgba(255,255,255,.1);
  border: 1.5px solid rgba(255,255,255,.2);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(6px);
}

.org-text {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.org-abbr {
  font-size: 11px;
  font-weight: 700;
  color: rgba(252,209,22,.75);
  letter-spacing: 2px;
  text-transform: uppercase;
}

.org-full {
  font-size: 12px;
  font-weight: 400;
  color: rgba(255,255,255,.45);
  line-height: 1.4;
}

/* ── Hero block ── */
.hero-block {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding-bottom: 32px;
}

.system-tag {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 10.5px;
  font-weight: 600;
  color: rgba(255,255,255,.4);
  text-transform: uppercase;
  letter-spacing: 1.2px;
  margin-bottom: 22px;
}

.tag-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #0038A8;
  box-shadow: 0 0 0 3px rgba(0,56,168,.3);
  animation: tagPulse 2.5s ease-in-out infinite;
  flex-shrink: 0;
}
@keyframes tagPulse {
  0%, 100% { box-shadow: 0 0 0 3px rgba(0,56,168,.3); }
  50%       { box-shadow: 0 0 0 6px rgba(0,56,168,.12); }
}

.hero-headline {
  font-family: 'Plus Jakarta Sans', sans-serif;
  font-size: 52px;
  font-weight: 800;
  color: #ffffff;
  line-height: 1.05;
  letter-spacing: -2px;
  margin-bottom: 20px;
  /* Subtle gradient on text */
  background: linear-gradient(140deg, #ffffff 50%, rgba(255,255,255,.55));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.hero-body {
  font-size: 13.5px;
  color: rgba(255,255,255,.38);
  line-height: 1.65;
  max-width: 300px;
  font-weight: 400;
}

/* ── Metrics strip ── */
.metrics-strip {
  display: flex;
  align-items: center;
  background: rgba(255,255,255,.05);
  border: 1px solid rgba(255,255,255,.08);
  border-radius: 14px;
  padding: 16px 20px;
  margin-bottom: 0;
  backdrop-filter: blur(10px);
}

.metric {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.metric-num {
  font-size: 13px;
  font-weight: 800;
  color: rgba(255,255,255,.85);
  letter-spacing: .5px;
  font-family: 'Plus Jakarta Sans', sans-serif;
}

.metric-lbl {
  font-size: 9.5px;
  font-weight: 500;
  color: rgba(255,255,255,.3);
  text-transform: uppercase;
  letter-spacing: .5px;
}

.metric-div {
  width: 1px;
  height: 28px;
  background: rgba(255,255,255,.1);
}

/* ── Flag bar ── */
.flag-bar {
  display: flex;
  margin: 20px -40px 0;
  height: 4px;
}
.flag-seg {
  flex: 1;
}
.flag-blue  { background: #0038A8; }
.flag-red   { background: #CE1126; }
.flag-gold  { background: #FCD116; }

/* Left panel background pixel grid (subtle) */
.left-panel::after {
  content: '';
  position: absolute;
  inset: 0;
  background-image:
    radial-gradient(rgba(255,255,255,.04) 1px, transparent 1px);
  background-size: 24px 24px;
  pointer-events: none;
  z-index: 1;
}

/* ══════════════════════════════════
   RIGHT PANEL
══════════════════════════════════ */
.right-panel {
  flex: 1;
  background: #F0F4FA;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px 40px;
  position: relative;
  overflow: hidden;
}

/* Geometric background shapes */
.right-texture {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    radial-gradient(circle at 75% 15%, rgba(0,56,168,.06) 0%, transparent 40%),
    radial-gradient(circle at 20% 90%, rgba(206,17,38,.04) 0%, transparent 35%);
}
.right-texture::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(148,163,184,.07) 1px, transparent 1px),
    linear-gradient(90deg, rgba(148,163,184,.07) 1px, transparent 1px);
  background-size: 40px 40px;
}

/* ── Form shell card ── */
.form-shell {
  width: 100%;
  max-width: 420px;
  background: #ffffff;
  border-radius: 20px;
  padding: 40px 38px;
  box-shadow:
    0 1px 2px rgba(0,0,0,.04),
    0 4px 16px rgba(0,0,0,.06),
    0 20px 60px rgba(0,56,168,.07);
  position: relative;
  z-index: 1;
  border: 1px solid rgba(0,0,0,.055);
}

/* Top accent stripe on card */
.form-shell::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 3px;
  background: linear-gradient(90deg, #0038A8 0%, #CE1126 50%, #FCD116 100%);
  border-radius: 20px 20px 0 0;
}

/* ── Status chip ── */
.status-chip {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 5px 12px;
  background: #EEF4FF;
  border: 1px solid #C7D9FF;
  border-radius: 20px;
  font-size: 10.5px;
  font-weight: 700;
  color: #1749C5;
  text-transform: uppercase;
  letter-spacing: .7px;
  margin-bottom: 22px;
}

.chip-pulse {
  width: 6px;
  height: 6px;
  background: #0038A8;
  border-radius: 50%;
  animation: chipPulse 2s ease-in-out infinite;
}
@keyframes chipPulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%       { opacity: .55; transform: scale(.75); }
}

/* ── Form heading ── */
.form-heading {
  margin-bottom: 28px;
}

.form-heading h2 {
  font-family: 'Plus Jakarta Sans', sans-serif;
  font-size: 26px;
  font-weight: 800;
  color: #0A1628;
  letter-spacing: -.6px;
  margin-bottom: 7px;
}

.form-heading p {
  font-size: 13.5px;
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
  border-radius: 10px;
  font-size: 13px;
  color: #991B1B;
  margin-bottom: 18px;
  line-height: 1.45;
}
.alert-error svg { flex-shrink: 0; margin-top: 1px; }

.alert-in-enter-active, .alert-in-leave-active { transition: all .2s ease; }
.alert-in-enter-from, .alert-in-leave-to { opacity: 0; transform: translateY(-6px); }

/* ── Google button ── */
.btn-google {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: 100%;
  padding: 13px 16px;
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
  background: #F8FAFF;
  border-color: #B8CCF0;
  box-shadow: 0 3px 12px rgba(0,56,168,.08);
  transform: translateY(-1px);
}
.btn-google:active:not(:disabled) { transform: none; }
.btn-google:disabled { opacity: .55; cursor: not-allowed; }

/* ── OR divider ── */
.or-divider {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 20px 0;
  font-size: 11.5px;
  font-weight: 600;
  color: #94A3B8;
  text-transform: uppercase;
  letter-spacing: .5px;
}
.or-divider::before,
.or-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: #EEF2F8;
}

/* ── Email form ── */
.email-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
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
  padding: 12px 40px;
  border: 1.5px solid #E5EAF2;
  border-radius: 11px;
  font-size: 14px;
  font-family: 'Inter', sans-serif;
  color: #0F172A;
  background: #FAFBFD;
  outline: none;
  transition: border-color .15s, box-shadow .15s, background .15s;
}
.input-wrap input:hover { border-color: #C5D2E8; }
.input-wrap input:focus {
  border-color: #0038A8;
  box-shadow: 0 0 0 3px rgba(0,56,168,.1);
  background: #fff;
}
.input-wrap input:focus + .input-icon,
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
  padding: 14px;
  background: linear-gradient(135deg, #002d8a 0%, #0038A8 50%, #1a56db 100%);
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 14.5px;
  font-weight: 700;
  font-family: 'Inter', sans-serif;
  cursor: pointer;
  transition: all .15s ease;
  box-shadow: 0 4px 16px rgba(0,56,168,.3), 0 1px 3px rgba(0,56,168,.2);
  margin-top: 4px;
  letter-spacing: .1px;
  position: relative;
  overflow: hidden;
}
.btn-primary::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(255,255,255,.08) 0%, transparent 60%);
  pointer-events: none;
}
.btn-primary:hover:not(:disabled) {
  background: linear-gradient(135deg, #00256e 0%, #002d8a 50%, #0038A8 100%);
  box-shadow: 0 6px 24px rgba(0,56,168,.4);
  transform: translateY(-1px);
}
.btn-primary:active:not(:disabled) {
  transform: none;
  box-shadow: 0 2px 8px rgba(0,56,168,.25);
}
.btn-primary:disabled {
  opacity: .5;
  cursor: not-allowed;
  transform: none;
}

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

/* ── Access note ── */
.access-note {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-top: 18px;
  padding: 10px 13px;
  background: #F6F9FF;
  border: 1px solid #DDE8F8;
  border-radius: 9px;
  font-size: 11.5px;
  color: #64748B;
  line-height: 1.5;
}
.access-note svg { flex-shrink: 0; margin-top: 1px; color: #0038A8; }

/* ── Footer ── */
.form-footer {
  margin-top: 22px;
  text-align: center;
  font-size: 11px;
  color: #B0BAC8;
  letter-spacing: .3px;
}

/* ══ RESPONSIVE ══ */
@media (max-width: 840px) {
  .left-panel { display: none; }
  .right-panel { padding: 32px 20px; background: #F0F4FA; }
}
@media (max-width: 480px) {
  .form-shell { padding: 32px 24px; border-radius: 16px; }
  .hero-headline { font-size: 40px; }
}
</style>