<template>
  <div class="login-root">

    <!-- ── LEFT PANEL ── -->
    <div class="login-left">
      <div class="left-inner">

        <!-- Brand -->
        <div class="brand-mark">
          <div class="brand-icon">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <path d="M3 5h16M3 11h10M3 17h13" stroke="white" stroke-width="2" stroke-linecap="round"/>
              <circle cx="17" cy="17" r="4" fill="#60A5FA"/>
              <path d="M15.2 17l1.3 1.3 2.5-2.5" stroke="white" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <span class="brand-name">PMES</span>
        </div>

        <!-- Hero -->
        <div class="hero-text">
          <div class="hero-eyebrow">
            <span class="eyebrow-dot"></span>
            Performance System
          </div>
          <h1>Monitor.<br/>Evaluate.<br/>Deliver.</h1>
          <p class="hero-sub">DSWD · Social Technology Bureau</p>
        </div>

        <!-- Stats -->
        <div class="stats-row">
          <div class="stat-item">
            <span class="stat-num">4</span>
            <span class="stat-lbl">Divisions</span>
          </div>
          <div class="stat-div"></div>
          <div class="stat-item">
            <span class="stat-num">2</span>
            <span class="stat-lbl">Semesters</span>
          </div>
          <div class="stat-div"></div>
          <div class="stat-item">
            <span class="stat-num">5★</span>
            <span class="stat-lbl">Max Rating</span>
          </div>
        </div>

        <!-- ── ANIMATED DECO GRID ── -->
        <div class="deco-grid" aria-hidden="true">
          <div
            v-for="i in 36"
            :key="i"
            class="deco-cell"
            :style="cellStyle(i)"
          ></div>
        </div>

        <!-- Floating orbs for depth -->
        <div class="orb orb-1"></div>
        <div class="orb orb-2"></div>
        <div class="orb orb-3"></div>

      </div>
    </div>

    <!-- ── RIGHT PANEL ── -->
    <div class="login-right">
      <div class="form-card">

        <!-- Header -->
        <div class="form-header">
          <div class="form-badge">
            <span class="badge-dot"></span>
            Secure Government Portal
          </div>
          <h2>Welcome back</h2>
          <p>Sign in with your <strong>@{{ domain }}</strong> account</p>
        </div>

        <!-- Error -->
        <transition name="slide-down">
          <div v-if="error" class="error-box" role="alert">
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <circle cx="7.5" cy="7.5" r="6.5" stroke="#EF4444" stroke-width="1.4"/>
              <path d="M7.5 4.5v3.5M7.5 10v.1" stroke="#EF4444" stroke-width="1.4" stroke-linecap="round"/>
            </svg>
            {{ error }}
          </div>
        </transition>

        <!-- Email / Password form -->
        <form @submit.prevent="handleEmailLogin" class="form-body" novalidate>

          <div class="field">
            <label for="email">Email address</label>
            <div class="input-wrap">
              <svg class="input-icon" width="15" height="15" viewBox="0 0 15 15" fill="none">
                <rect x="1.5" y="3" width="12" height="9" rx="1.5" stroke="#94A3B8" stroke-width="1.3"/>
                <path d="M1.5 5l6 4 6-4" stroke="#94A3B8" stroke-width="1.3" stroke-linecap="round"/>
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

          <div class="field">
            <label for="password">
              Password
              <a href="#" class="forgot">Forgot password?</a>
            </label>
            <div class="input-wrap">
              <svg class="input-icon" width="15" height="15" viewBox="0 0 15 15" fill="none">
                <rect x="2.5" y="6.5" width="10" height="7" rx="1.5" stroke="#94A3B8" stroke-width="1.3"/>
                <path d="M5 6.5V5a2.5 2.5 0 015 0v1.5" stroke="#94A3B8" stroke-width="1.3" stroke-linecap="round"/>
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
              <button type="button" class="pw-toggle" @click="showPw = !showPw" :title="showPw ? 'Hide' : 'Show'">
                <svg v-if="!showPw" width="15" height="15" viewBox="0 0 15 15" fill="none">
                  <path d="M1 7.5S3.5 2.5 7.5 2.5 14 7.5 14 7.5 11.5 12.5 7.5 12.5 1 7.5 1 7.5z" stroke="#94A3B8" stroke-width="1.3"/>
                  <circle cx="7.5" cy="7.5" r="2" stroke="#94A3B8" stroke-width="1.3"/>
                </svg>
                <svg v-else width="15" height="15" viewBox="0 0 15 15" fill="none">
                  <path d="M1 7.5S3.5 2.5 7.5 2.5 14 7.5 14 7.5 11.5 12.5 7.5 12.5 1 7.5 1 7.5z" stroke="#94A3B8" stroke-width="1.3"/>
                  <circle cx="7.5" cy="7.5" r="2" stroke="#94A3B8" stroke-width="1.3"/>
                  <path d="M2 2l11 11" stroke="#94A3B8" stroke-width="1.3" stroke-linecap="round"/>
                </svg>
              </button>
            </div>
          </div>

          <button
            type="submit"
            class="btn-primary"
            :disabled="loading || !email || !password"
          >
            <span v-if="loading && loginMethod === 'email'" class="spinner"></span>
            <svg v-else width="15" height="15" viewBox="0 0 15 15" fill="none">
              <path d="M2 7.5h11M9.5 4l3.5 3.5L9.5 11" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            {{ loading && loginMethod === 'email' ? 'Signing in…' : 'Sign in' }}
          </button>
        </form>

        <!-- Divider -->
        <div class="divider"><span>or continue with</span></div>

        <!-- Google Sign-In -->
        <button
          class="btn-google"
          @click="handleGoogleLogin"
          :disabled="loading"
          type="button"
        >
          <span v-if="loading && loginMethod === 'google'" class="spinner-dark"></span>
          <svg v-else width="17" height="17" viewBox="0 0 17 17" fill="none">
            <path d="M16.24 8.73c0-.6-.05-1.18-.14-1.73H8.5v3.27h4.34a3.72 3.72 0 01-1.61 2.44v2.03h2.6c1.52-1.4 2.4-3.47 2.4-6.01z" fill="#4285F4"/>
            <path d="M8.5 17c2.18 0 4.01-.72 5.35-1.96l-2.6-2.03c-.72.48-1.64.77-2.75.77-2.12 0-3.91-1.43-4.55-3.35H1.27v2.09A8 8 0 008.5 17z" fill="#34A853"/>
            <path d="M3.95 10.43A4.82 4.82 0 013.7 8.87c0-.54.1-1.07.25-1.56V5.22H1.27A8 8 0 000 8.87c0 1.29.31 2.51.86 3.6l2.09-1.63.94-.41h.06z" fill="#FBBC05"/>
            <path d="M8.5 3.46c1.19 0 2.26.41 3.1 1.21l2.32-2.32A8 8 0 001.27 5.22l2.68 2.09c.64-1.92 2.43-3.35 4.55-3.85z" fill="#EA4335"/>
          </svg>
          {{ loading && loginMethod === 'google' ? 'Connecting…' : 'Sign in with Google' }}
        </button>

        <!-- Info note -->
        <div class="info-note">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <circle cx="6.5" cy="6.5" r="5.5" stroke="#94A3B8" stroke-width="1.2"/>
            <path d="M6.5 5.5v4M6.5 4v.1" stroke="#94A3B8" stroke-width="1.2" stroke-linecap="round"/>
          </svg>
          Access is restricted to <strong>@{{ domain }}</strong> accounts only.
        </div>

        <!-- Footer -->
        <p class="form-footer">
          DSWD · STB · {{ new Date().getFullYear() }} &nbsp;·&nbsp; v2.0
        </p>

      </div>
    </div>

  </div>
</template>

<script setup>
import { ref } from 'vue'
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

const domain   = import.meta.env.VITE_ALLOWED_EMAIL_DOMAIN || 'dswd.gov.ph'
const redirect = route.query.redirect || '/dashboard'

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

// ── Grid cell style helper ──
// Each cell gets a unique animation-delay so they ripple independently.
function cellStyle(i) {
  const col    = (i - 1) % 6
  const row    = Math.floor((i - 1) / 6)
  // Wave delay radiates from top-left corner
  const delay  = ((col + row) * 0.12).toFixed(2)
  // Base opacity varies to create a living texture
  const base   = 0.06 + ((i * 0.037) % 0.18)
  return {
    '--delay':   `${delay}s`,
    '--base-op': base.toFixed(3)
  }
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400&family=Instrument+Serif:ital@0;1&display=swap');

* { box-sizing: border-box; margin: 0; padding: 0; }

/* ── Root ── */
.login-root {
  display: flex;
  min-height: 100vh;
  font-family: 'Plus Jakarta Sans', sans-serif;
  background: #F8FAFC;
}

/* ══════════════════════════════════════════════
   LEFT PANEL
══════════════════════════════════════════════ */
.login-left {
  width: 440px;
  flex-shrink: 0;
  background: linear-gradient(155deg, #060f1e 0%, #0d2137 45%, #0f3460 100%);
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: stretch;
}

.left-inner {
  position: relative;
  z-index: 3;
  padding: 52px 44px;
  display: flex;
  flex-direction: column;
  gap: 36px;
  width: 100%;
}

/* ── Floating orbs (depth layer) ── */
.orb {
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
  z-index: 1;
}
.orb-1 {
  width: 340px; height: 340px;
  top: -100px; right: -120px;
  background: radial-gradient(circle, rgba(96,165,250,.13) 0%, transparent 70%);
}
.orb-2 {
  width: 280px; height: 280px;
  bottom: -80px; left: -80px;
  background: radial-gradient(circle, rgba(139,92,246,.10) 0%, transparent 70%);
}
.orb-3 {
  width: 180px; height: 180px;
  top: 42%; left: 30%;
  background: radial-gradient(circle, rgba(34,197,94,.07) 0%, transparent 70%);
  animation: orbPulse 8s ease-in-out infinite;
}
@keyframes orbPulse {
  0%, 100% { transform: scale(1) translate(0, 0); opacity: 1; }
  33%       { transform: scale(1.15) translate(10px, -15px); opacity: .7; }
  66%       { transform: scale(.9) translate(-8px, 12px); opacity: .9; }
}

/* ── Brand ── */
.brand-mark {
  display: flex;
  align-items: center;
  gap: 12px;
  position: relative;
  z-index: 3;
}
.brand-icon {
  width: 42px; height: 42px;
  border-radius: 10px;
  background: rgba(255,255,255,.12);
  border: 1px solid rgba(255,255,255,.15);
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(8px);
}
.brand-name {
  font-size: 20px;
  font-weight: 800;
  color: white;
  letter-spacing: -0.3px;
}

/* ── Eyebrow + Hero ── */
.hero-eyebrow {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 11px;
  font-weight: 600;
  color: rgba(255,255,255,.45);
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 14px;
}
.eyebrow-dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: #60A5FA;
  animation: pulse 2.5s ease-in-out infinite;
  flex-shrink: 0;
}
@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%       { opacity: .5; transform: scale(.75); }
}

.hero-text {
  position: relative;
  z-index: 3;
}
.hero-text h1 {
  font-family: 'Instrument Serif', Georgia, serif;
  font-size: 46px;
  font-weight: 400;
  color: white;
  line-height: 1.1;
  letter-spacing: -1.5px;
  margin-bottom: 14px;
}
.hero-sub {
  font-size: 12px;
  color: rgba(255,255,255,.38);
  letter-spacing: .6px;
  text-transform: uppercase;
  font-weight: 500;
}

/* ── Stats Row ── */
.stats-row {
  display: flex;
  align-items: center;
  gap: 0;
  padding: 18px 20px;
  background: rgba(255,255,255,.06);
  border: 1px solid rgba(255,255,255,.09);
  border-radius: 14px;
  backdrop-filter: blur(12px);
  position: relative;
  z-index: 3;
}
.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
  gap: 3px;
}
.stat-num {
  font-family: 'Instrument Serif', serif;
  font-size: 26px;
  color: #93C5FD;
  line-height: 1;
}
.stat-lbl {
  font-size: 9.5px;
  color: rgba(255,255,255,.38);
  text-transform: uppercase;
  letter-spacing: .5px;
  font-weight: 600;
}
.stat-div {
  width: 1px;
  height: 30px;
  background: rgba(255,255,255,.1);
}

/* ══════════════════════════════════════════════
   ANIMATED DECO GRID
   FIX: Uses @keyframes deco-float with CSS custom
   properties per cell so each cell animates at a
   unique phase, creating a flowing ripple effect.
══════════════════════════════════════════════ */
.deco-grid {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 216px;
  height: 216px;
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 5px;
  padding: 20px;
  pointer-events: none;
  z-index: 2;
}

.deco-cell {
  aspect-ratio: 1;
  border-radius: 3px;
  /* THE FIX: each cell independently animates opacity + scale */
  animation: decoFloat 3.6s ease-in-out infinite var(--delay, 0s);
  /* Baseline opacity from the JS style binding */
  opacity: var(--base-op, 0.08);
}

@keyframes decoFloat {
  0%, 100% {
    opacity: var(--base-op, 0.08);
    transform: scale(1);
    background: rgba(255, 255, 255, 0.9);
  }
  40% {
    opacity: calc(var(--base-op, 0.08) * 3.5);
    transform: scale(1.15);
    background: rgba(96, 165, 250, 0.95);
  }
  70% {
    opacity: calc(var(--base-op, 0.08) * 1.8);
    transform: scale(1.05);
    background: rgba(139, 92, 246, 0.8);
  }
}

/* ══════════════════════════════════════════════
   RIGHT PANEL
══════════════════════════════════════════════ */
.login-right {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px 28px;
  background: #F8FAFC;
  position: relative;
}

/* Subtle grid texture on the right side */
.login-right::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(148,163,184,.06) 1px, transparent 1px),
    linear-gradient(90deg, rgba(148,163,184,.06) 1px, transparent 1px);
  background-size: 32px 32px;
  pointer-events: none;
}

.form-card {
  width: 100%;
  max-width: 400px;
  position: relative;
  z-index: 1;
}

/* ── Form Header ── */
.form-header {
  margin-bottom: 30px;
}
.form-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 11px;
  background: #EFF6FF;
  border: 1px solid #BFDBFE;
  border-radius: 20px;
  font-size: 10.5px;
  font-weight: 700;
  color: #1D4ED8;
  text-transform: uppercase;
  letter-spacing: .6px;
  margin-bottom: 18px;
}
.badge-dot {
  width: 5px; height: 5px;
  background: #3B82F6;
  border-radius: 50%;
  animation: pulse 2s infinite;
}
.form-header h2 {
  font-size: 28px;
  font-weight: 800;
  color: #0F172A;
  letter-spacing: -.7px;
  margin-bottom: 7px;
}
.form-header p {
  font-size: 13.5px;
  color: #64748B;
  line-height: 1.5;
}
.form-header strong {
  color: #1D4ED8;
  font-weight: 700;
}

/* ── Error Box ── */
.error-box {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  padding: 12px 14px;
  background: #FEF2F2;
  border: 1px solid #FECACA;
  border-radius: 10px;
  font-size: 13px;
  color: #B91C1C;
  margin-bottom: 20px;
  line-height: 1.4;
}
.slide-down-enter-active,
.slide-down-leave-active { transition: all .2s ease; }
.slide-down-enter-from,
.slide-down-leave-to     { opacity: 0; transform: translateY(-8px); }

/* ── Form Body ── */
.form-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.field label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  font-weight: 600;
  color: #334155;
}
.forgot {
  font-size: 12px;
  font-weight: 500;
  color: #2563EB;
  text-decoration: none;
  transition: color .15s;
}
.forgot:hover { color: #1D4ED8; text-decoration: underline; }

.input-wrap {
  position: relative;
  display: flex;
  align-items: center;
}
.input-icon {
  position: absolute;
  left: 12px;
  pointer-events: none;
  flex-shrink: 0;
}
.input-wrap input {
  width: 100%;
  padding: 12px 42px;
  border: 1.5px solid #E2E8F0;
  border-radius: 11px;
  font-size: 14px;
  font-family: 'Plus Jakarta Sans', sans-serif;
  color: #0F172A;
  background: white;
  outline: none;
  transition: border-color .15s, box-shadow .15s, background .15s;
}
.input-wrap input:focus {
  border-color: #2563EB;
  box-shadow: 0 0 0 3px rgba(37,99,235,.1);
}
.input-wrap input:disabled {
  background: #F8FAFC;
  cursor: not-allowed;
  color: #94A3B8;
}
.input-wrap input::placeholder { color: #CBD5E1; }

.pw-toggle {
  position: absolute;
  right: 12px;
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  color: #94A3B8;
  transition: color .15s;
  border-radius: 4px;
}
.pw-toggle:hover { color: #64748B; }

/* ── Primary Button ── */
.btn-primary {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 13px;
  background: linear-gradient(135deg, #1E40AF, #2563EB 60%, #3B82F6);
  color: white;
  border: none;
  border-radius: 11px;
  font-size: 14.5px;
  font-weight: 700;
  font-family: 'Plus Jakarta Sans', sans-serif;
  cursor: pointer;
  transition: all .18s ease;
  box-shadow: 0 4px 16px rgba(37,99,235,.32), 0 1px 3px rgba(37,99,235,.2);
  margin-top: 4px;
  letter-spacing: .1px;
}
.btn-primary:hover:not(:disabled) {
  background: linear-gradient(135deg, #1e3a8a, #1D4ED8 60%, #2563EB);
  box-shadow: 0 6px 24px rgba(37,99,235,.4), 0 2px 4px rgba(37,99,235,.25);
  transform: translateY(-1px);
}
.btn-primary:active:not(:disabled) {
  transform: translateY(0);
  box-shadow: 0 2px 8px rgba(37,99,235,.3);
}
.btn-primary:disabled {
  opacity: .55;
  cursor: not-allowed;
  transform: none;
}

/* ── Spinner ── */
.spinner {
  width: 15px; height: 15px;
  border: 2px solid rgba(255,255,255,.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin .6s linear infinite;
}
.spinner-dark {
  width: 15px; height: 15px;
  border: 2px solid #E2E8F0;
  border-top-color: #374151;
  border-radius: 50%;
  animation: spin .6s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* ── Divider ── */
.divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 22px 0;
  color: #94A3B8;
  font-size: 11.5px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: .5px;
}
.divider::before,
.divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: #E2E8F0;
}

/* ── Google Button ── */
.btn-google {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: 100%;
  padding: 12.5px;
  background: white;
  border: 1.5px solid #E2E8F0;
  border-radius: 11px;
  font-size: 14px;
  font-weight: 600;
  font-family: 'Plus Jakarta Sans', sans-serif;
  color: #374151;
  cursor: pointer;
  transition: all .15s ease;
  box-shadow: 0 1px 3px rgba(0,0,0,.06);
}
.btn-google:hover:not(:disabled) {
  background: #F8FAFC;
  border-color: #CBD5E1;
  box-shadow: 0 4px 14px rgba(0,0,0,.08);
  transform: translateY(-1px);
}
.btn-google:active:not(:disabled) {
  transform: translateY(0);
}
.btn-google:disabled {
  opacity: .6;
  cursor: not-allowed;
}

/* ── Info Note ── */
.info-note {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-top: 16px;
  padding: 10px 13px;
  background: #F8FAFC;
  border: 1px solid #E8EEF6;
  border-radius: 9px;
  font-size: 12px;
  color: #64748B;
  line-height: 1.5;
}
.info-note svg { flex-shrink: 0; margin-top: 1px; }
.info-note strong { color: #374151; font-weight: 600; }

/* ── Footer ── */
.form-footer {
  margin-top: 28px;
  text-align: center;
  font-size: 11px;
  color: #94A3B8;
  letter-spacing: .3px;
}

/* ── Responsive ── */
@media (max-width: 768px) {
  .login-left { display: none; }
  .login-right { padding: 32px 20px; }
}
@media (max-width: 420px) {
  .form-header h2 { font-size: 24px; }
}
</style>