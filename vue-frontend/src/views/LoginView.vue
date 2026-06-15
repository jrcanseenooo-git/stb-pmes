<template>
  <div class="login-root">

    <!-- ══ LEFT PANEL ══ -->
    <aside class="left-panel">
      <div class="left-inner">

        <!-- Org identity -->
        <div class="org-header">
          <div class="seal-wrap">
            <div class="sun-rays" aria-hidden="true">
              <span v-for="i in 8" :key="i" class="ray" :style="`--r:${i}`"></span>
            </div>
            <div class="seal-circle">
              <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
                <path d="M4 6h18M4 13h12M4 20h15" stroke="white" stroke-width="2.1" stroke-linecap="round"/>
                <circle cx="20" cy="19" r="5" fill="rgba(255,255,255,.12)" stroke="rgba(255,255,255,.35)" stroke-width="1.4"/>
                <path d="M18.3 19l1.5 1.5 2.8-2.8" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
          </div>
          <div class="org-text">
            <div class="org-abbr">DSWD · STB</div>
            <div class="org-full">Department of Social Welfare<br>and Development</div>
          </div>
        </div>

        <!-- Hero -->
        <div class="hero-block">
          <div class="system-tag">
            Performance Monitoring &amp; Evaluation System
          </div>
          <h1 class="hero-headline">
            Monitor.<br>Evaluate.<br>Deliver.
          </h1>
          <p class="hero-body">
            Unified performance tracking for the Social Technology Bureau — from KRA targets to accomplishment records, all in one place.
          </p>
        </div>

      </div>
    </aside>

    <!-- ══ RIGHT PANEL ══ -->
    <main class="right-panel">
      <div class="right-bg" aria-hidden="true"></div>

      <div class="form-shell">

        <!-- Status chip -->
        <div class="status-chip">
          <span class="chip-dot"></span>
          Secure Access Portal
        </div>

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

function cellStyle(i) {
  const col   = (i - 1) % 6
  const row   = Math.floor((i - 1) / 6)
  const delay = ((col + row) * 0.12).toFixed(2)
  const base  = 0.05 + ((i * 0.037) % 0.16)
  return { '--delay': `${delay}s`, '--base-op': base.toFixed(3) }
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Plus+Jakarta+Sans:wght@700;800&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

/* Kill any scroll on the host page while login is mounted */
:global(html), :global(body) {
  overflow: hidden;
  height: 100%;
}

/* ══ ROOT — true full-bleed split, zero overflow ══ */
.login-root {
  display: flex;
  position: fixed;   /* covers the full viewport regardless of body/html state */
  inset: 0;          /* top:0 right:0 bottom:0 left:0 */
  font-family: 'Inter', system-ui, sans-serif;
  overflow: hidden;
}

/* ══════════════════════════════════
   LEFT PANEL  (50% width)
══════════════════════════════════ */
.left-panel {
  width: 50%;
  flex-shrink: 0;
  background:
    radial-gradient(ellipse at 18% 8%,  rgba(0,56,168,.60) 0%, transparent 52%),
    radial-gradient(ellipse at 85% 88%, rgba(206,17,38,.28) 0%, transparent 48%),
    radial-gradient(ellipse at 60% 40%, rgba(0,30,100,.40)  0%, transparent 60%),
    linear-gradient(162deg, #040c1c 0%, #081830 35%, #0c2040 65%, #0e2850 100%);
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* Dot-grid texture overlay */
.left-panel::after {
  content: '';
  position: absolute;
  inset: 0;
  background-image: radial-gradient(rgba(255,255,255,.035) 1px, transparent 1px);
  background-size: 22px 22px;
  pointer-events: none;
  z-index: 1;
}

.left-inner {
  position: relative;
  z-index: 2;
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 36px 44px 0;
  min-height: 0;   /* allow flex children to shrink below content size */
}

/* ── Org header ── */
.org-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 0;
  flex-shrink: 0;
}

.seal-wrap {
  position: relative;
  width: 54px;
  height: 54px;
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
  height: 18px;
  background: linear-gradient(to bottom, rgba(252,209,22,.65), transparent);
  border-radius: 1px;
  top: 50%; left: 50%;
  transform-origin: 50% 0;
  transform: translateX(-50%) translateY(-100%) rotate(calc((var(--r) - 1) * 45deg));
}

.seal-circle {
  position: absolute;
  inset: 7px;
  background: rgba(255,255,255,.1);
  border: 1.5px solid rgba(255,255,255,.18);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(8px);
}

.org-text { display: flex; flex-direction: column; gap: 4px; }

.org-abbr {
  font-size: 10.5px;
  font-weight: 700;
  color: rgba(252,209,22,.8);
  letter-spacing: 2.2px;
  text-transform: uppercase;
}

.org-full {
  font-size: 11.5px;
  font-weight: 400;
  color: rgba(255,255,255,.38);
  line-height: 1.45;
}

/* ── Hero block ── */
.hero-block {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 20px 0 16px;
  min-height: 0;
}

.system-tag {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  font-size: 10px;
  font-weight: 600;
  color: rgba(255,255,255,.38);
  text-transform: uppercase;
  letter-spacing: 1.5px;
  margin-bottom: 24px;
}

.hero-headline {
  font-family: 'Plus Jakarta Sans', sans-serif;
  font-size: clamp(44px, 4.5vw, 64px);
  font-weight: 800;
  color: #ffffff;
  line-height: 1.0;
  letter-spacing: -2.5px;
  margin-bottom: 22px;
  background: linear-gradient(145deg, #ffffff 45%, rgba(255,255,255,.5));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.hero-body {
  font-size: 13.5px;
  color: rgba(255,255,255,.36);
  line-height: 1.7;
  max-width: 340px;
  font-weight: 400;
}

/* ── Feature strip ── */
.feature-strip {
  display: flex;
  align-items: center;
  background: rgba(255,255,255,.045);
  border: 1px solid rgba(255,255,255,.07);
  border-radius: 16px;
  padding: 18px 24px;
  backdrop-filter: blur(12px);
  flex-shrink: 0;
  margin-bottom: 0;
}

.feature-item {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 12px;
}

.feature-icon {
  width: 34px; height: 34px;
  background: rgba(255,255,255,.07);
  border: 1px solid rgba(255,255,255,.1);
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.feature-label {
  font-size: 12px;
  font-weight: 700;
  color: rgba(255,255,255,.82);
  font-family: 'Plus Jakarta Sans', sans-serif;
  letter-spacing: .3px;
}

.feature-desc {
  font-size: 10px;
  font-weight: 500;
  color: rgba(255,255,255,.3);
  text-transform: uppercase;
  letter-spacing: .5px;
  margin-top: 2px;
}

.feature-divider {
  width: 1px;
  height: 32px;
  background: rgba(255,255,255,.09);
  margin: 0 4px;
  flex-shrink: 0;
}

/* ── Flag bar ── */
.flag-bar {
  display: flex;
  margin: 20px -44px 0;
  height: 5px;
  flex-shrink: 0;
}
.flag-seg { flex: 1; }
.flag-blue { background: #0038A8; }
.flag-red  { background: #CE1126; }
.flag-gold { background: #FCD116; }

/* ══════════════════════════════════
   RIGHT PANEL  (50% width, full bleed)
══════════════════════════════════ */
.right-panel {
  width: 50%;
  flex-shrink: 0;
  background: #EDF1F9;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px 40px;
  position: relative;
  overflow: hidden;   /* hard clip — card must fit */
}

/* Subtle background texture */
.right-bg {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    radial-gradient(circle at 78% 12%, rgba(0,56,168,.06) 0%, transparent 42%),
    radial-gradient(circle at 18% 88%, rgba(206,17,38,.04) 0%, transparent 36%);
}
.right-bg::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(148,163,184,.065) 1px, transparent 1px),
    linear-gradient(90deg, rgba(148,163,184,.065) 1px, transparent 1px);
  background-size: 40px 40px;
}

/* ── Form shell ── */
.form-shell {
  width: 100%;
  max-width: 420px;
  background: #ffffff;
  border-radius: 20px;
  padding: 32px 36px 28px;
  box-shadow:
    0 1px 2px rgba(0,0,0,.04),
    0 4px 18px rgba(0,0,0,.06),
    0 24px 64px rgba(0,56,168,.08);
  position: relative;
  z-index: 1;
  border: 1px solid rgba(0,0,0,.05);
}

/* Filipino flag accent stripe on card top */
.form-shell::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 4px;
  background: linear-gradient(90deg,
    #0038A8 0%, #0038A8 33.3%,
    #CE1126 33.3%, #CE1126 66.6%,
    #FCD116 66.6%, #FCD116 100%
  );
  border-radius: 22px 22px 0 0;
}

/* ── Status chip ── */
.status-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 4px 11px;
  background: #EEF4FF;
  border: 1px solid #C7D9FF;
  border-radius: 20px;
  font-size: 10px;
  font-weight: 700;
  color: #1749C5;
  text-transform: uppercase;
  letter-spacing: .8px;
  margin-bottom: 16px;
}

.chip-dot {
  width: 6px; height: 6px;
  background: #0038A8;
  border-radius: 50%;
  animation: chipPulse 2.2s ease-in-out infinite;
}
@keyframes chipPulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%       { opacity: .5; transform: scale(.7); }
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
  background: linear-gradient(135deg, #002880 0%, #0038A8 50%, #1a52d4 100%);
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
  position: relative;
  overflow: hidden;
}
.btn-primary::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(255,255,255,.1) 0%, transparent 55%);
  pointer-events: none;
}
.btn-primary:hover:not(:disabled) {
  background: linear-gradient(135deg, #001f6a 0%, #002880 50%, #0038A8 100%);
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
@media (max-width: 900px) {
  :global(html), :global(body) { overflow: auto; height: auto; }
  .login-root { position: static; flex-direction: column; height: auto; min-height: 100vh; overflow: auto; }
  .left-panel  { width: 100%; height: auto; }
  .left-inner  { padding: 28px 28px 0; }
  .hero-block  { padding: 16px 0 14px; }
  .right-panel { width: 100%; padding: 32px 20px 40px; overflow: visible; }
  .flag-bar    { margin: 16px -28px 0; }
}

@media (max-width: 480px) {
  .left-inner  { padding: 24px 20px 0; }
  .form-shell  { padding: 28px 20px 24px; border-radius: 16px; }
  .flag-bar    { margin: 16px -20px 0; }
  .hero-headline { font-size: 36px; letter-spacing: -1.5px; }
}
</style>