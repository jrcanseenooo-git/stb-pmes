<template>
  <div class="login-root">

    <!-- Left panel -->
    <div class="login-left">
      <div class="left-inner">

        <div class="brand-mark">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <rect width="48" height="48" rx="12" fill="white" fill-opacity="0.15"/>
            <path d="M12 16h24M12 24h16M12 32h20" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
            <circle cx="36" cy="32" r="6" fill="#60A5FA" fill-opacity="0.9"/>
            <path d="M33 32l2 2 4-4" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span class="brand-name">PMES</span>
        </div>

        <div class="hero-text">
          <h1>Performance<br/>Monitoring &amp;<br/>Evaluation<br/>System</h1>
          <p>DSWD · Social Technology Bureau</p>
        </div>

        <div class="deco-grid">
          <div v-for="i in 24" :key="i" class="deco-cell" :style="{ opacity: (i * 0.037) % 0.45 + 0.05 }"></div>
        </div>
      </div>
    </div>

    <!-- Right panel -->
    <div class="login-right">
      <div class="form-card">

        <!-- Header -->
        <div class="form-header">
          <div class="form-badge">
            <span class="badge-dot"></span>
            Secure Government Access
          </div>
          <h2>Sign in to your account</h2>
          <p>Access restricted to <strong>@{{ domain }}</strong> accounts</p>
        </div>

        <!-- Error -->
        <transition name="slide-down">
          <div v-if="error" class="error-box">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="7" stroke="#EF4444" stroke-width="1.5"/>
              <path d="M8 5v3M8 10.5v.5" stroke="#EF4444" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
            {{ error }}
          </div>
        </transition>

        <!-- Email / Password -->
        <form @submit.prevent="handleEmailLogin" class="form-body">
          <div class="field">
            <label>Email address</label>
            <div class="input-wrap">
              <svg class="input-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="1" y="3" width="14" height="10" rx="2" stroke="#94A3B8" stroke-width="1.5"/>
                <path d="M1 5l7 5 7-5" stroke="#94A3B8" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
              <input
                v-model="email"
                type="email"
                placeholder="yourname@dswd.gov.ph"
                autocomplete="email"
                :disabled="loading"
                required
              />
            </div>
          </div>

          <div class="field">
            <label>
              Password
              <a href="#" class="forgot" @click.prevent>Forgot password?</a>
            </label>
            <div class="input-wrap">
              <svg class="input-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="3" y="7" width="10" height="7" rx="1.5" stroke="#94A3B8" stroke-width="1.5"/>
                <path d="M5 7V5a3 3 0 016 0v2" stroke="#94A3B8" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
              <input
                v-model="password"
                :type="showPw ? 'text' : 'password'"
                placeholder="••••••••"
                autocomplete="current-password"
                :disabled="loading"
                required
              />
              <button type="button" class="pw-toggle" @click="showPw = !showPw">
                <svg v-if="!showPw" width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" stroke="#94A3B8" stroke-width="1.5"/>
                  <circle cx="8" cy="8" r="2" stroke="#94A3B8" stroke-width="1.5"/>
                </svg>
                <svg v-else width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M2 2l12 12M6.5 6.6A2 2 0 0010 9.5M4.2 4.3C2.8 5.3 1.7 6.7 1 8c1.2 2.5 3.8 5 7 5a8 8 0 003.8-1M6 3.2A8 8 0 018 3c3.2 0 5.8 2.5 7 5a9.5 9.5 0 01-2 2.8" stroke="#94A3B8" stroke-width="1.5" stroke-linecap="round"/>
                </svg>
              </button>
            </div>
          </div>

          <button type="submit" class="btn-primary" :disabled="loading">
            <span v-if="loading && loginMethod === 'email'" class="spinner"></span>
            <svg v-else width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 8h10M9 4l4 4-4 4" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            {{ loading && loginMethod === 'email' ? 'Signing in…' : 'Sign in' }}
          </button>
        </form>

        <!-- Divider -->
        <div class="divider"><span>or continue with</span></div>

        <!-- Google Sign-In -->
        <button
          class="btn-google"
          :disabled="loading"
          @click="handleGoogleLogin"
        >
          <span v-if="loading && loginMethod === 'google'" class="spinner-dark"></span>
          <svg v-else width="18" height="18" viewBox="0 0 18 18">
            <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
            <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z"/>
            <path fill="#FBBC05" d="M3.964 10.706A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.038l3.007-2.332z"/>
            <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58z"/>
          </svg>
          {{ loading && loginMethod === 'google' ? 'Signing in…' : 'Sign in with Google' }}
        </button>

        <!-- Info note -->
        <div class="info-note">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <circle cx="6.5" cy="6.5" r="5.5" stroke="#94A3B8" stroke-width="1.2"/>
            <path d="M6.5 6v3M6.5 4.5v.1" stroke="#94A3B8" stroke-width="1.2" stroke-linecap="round"/>
          </svg>
          Use your <strong>@{{ domain }}</strong> Google account for seamless access.
        </div>

        <!-- Footer -->
        <p class="form-footer">
          DSWD &bull; Social Technology Bureau &bull; {{ new Date().getFullYear() }}
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
const loginMethod = ref('')   // 'email' | 'google'
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
    loading.value = false
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
    loading.value = false
    loginMethod.value = ''
  }
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Instrument+Serif:ital@0;1&display=swap');

* { box-sizing: border-box; margin: 0; padding: 0; }

.login-root {
  display: flex;
  min-height: 100vh;
  font-family: 'Plus Jakarta Sans', sans-serif;
  background: #F8FAFC;
}

/* ── LEFT PANEL ── */
.login-left {
  width: 420px;
  flex-shrink: 0;
  background: linear-gradient(145deg, #0D2137 0%, #1a3a5c 50%, #0f3460 100%);
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: stretch;
}

.login-left::before {
  content: '';
  position: absolute;
  top: -100px; right: -100px;
  width: 400px; height: 400px;
  background: radial-gradient(circle, rgba(96,165,250,.15) 0%, transparent 70%);
  pointer-events: none;
}

.login-left::after {
  content: '';
  position: absolute;
  bottom: -80px; left: -80px;
  width: 300px; height: 300px;
  background: radial-gradient(circle, rgba(139,92,246,.12) 0%, transparent 70%);
  pointer-events: none;
}

.left-inner {
  position: relative; z-index: 2;
  padding: 48px 40px;
  display: flex; flex-direction: column;
  gap: 40px; width: 100%;
}

.brand-mark {
  display: flex; align-items: center; gap: 12px;
}

.brand-name {
  font-size: 22px; font-weight: 800;
  color: white; letter-spacing: -0.5px;
}

.hero-text h1 {
  font-family: 'Instrument Serif', Georgia, serif;
  font-size: 42px; font-weight: 400;
  color: white; line-height: 1.15;
  letter-spacing: -1px; margin-bottom: 16px;
}

.hero-text p {
  font-size: 13px; color: rgba(255,255,255,.45);
  letter-spacing: .5px; text-transform: uppercase; font-weight: 500;
}

.stats-row {
  display: flex; align-items: center; gap: 20px;
  padding: 20px;
  background: rgba(255,255,255,.07);
  border: 1px solid rgba(255,255,255,.1);
  border-radius: 12px;
  backdrop-filter: blur(10px);
}

.stat-item {
  display: flex; flex-direction: column;
  align-items: center; flex: 1;
}

.stat-num {
  font-size: 28px; font-weight: 800;
  color: #60A5FA; line-height: 1;
  font-family: 'Instrument Serif', serif;
}

.stat-lbl {
  font-size: 10px; color: rgba(255,255,255,.45);
  text-transform: uppercase; letter-spacing: .5px;
  margin-top: 4px; font-weight: 500;
}

.stat-div {
  width: 1px; height: 32px;
  background: rgba(255,255,255,.12);
}

.deco-grid {
  position: absolute;
  bottom: 0; right: 0;
  width: 200px; height: 200px;
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 4px; padding: 16px;
  pointer-events: none;
}

.deco-cell {
  aspect-ratio: 1;
  background: white;
  border-radius: 2px;
}

/* ── RIGHT PANEL ── */
.login-right {
  flex: 1;
  display: flex; align-items: center; justify-content: center;
  padding: 40px 24px;
  background: #F8FAFC;
}

.form-card {
  width: 100%; max-width: 420px;
}

/* Header */
.form-header { margin-bottom: 32px; }

.form-badge {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 4px 10px;
  background: #EFF6FF; border: 1px solid #BFDBFE;
  border-radius: 20px;
  font-size: 11px; font-weight: 600; color: #2563EB;
  text-transform: uppercase; letter-spacing: .5px;
  margin-bottom: 16px;
}

.badge-dot {
  width: 6px; height: 6px;
  background: #2563EB; border-radius: 50%;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%,100% { opacity:1; transform:scale(1); }
  50%      { opacity:.5; transform:scale(.8); }
}

.form-header h2 {
  font-size: 26px; font-weight: 700;
  color: #0F172A; letter-spacing: -.5px; margin-bottom: 6px;
}

.form-header p { font-size: 13px; color: #64748B; }
.form-header strong { color: #2563EB; font-weight: 600; }

/* Error */
.error-box {
  display: flex; align-items: center; gap: 8px;
  padding: 12px 14px;
  background: #FEF2F2; border: 1px solid #FECACA;
  border-radius: 10px;
  font-size: 13px; color: #B91C1C;
  margin-bottom: 20px;
}

.slide-down-enter-active, .slide-down-leave-active {
  transition: all .2s ease;
}
.slide-down-enter-from, .slide-down-leave-to {
  opacity: 0; transform: translateY(-8px);
}

/* Form */
.form-body {
  display: flex; flex-direction: column; gap: 18px;
}

.field { display: flex; flex-direction: column; gap: 6px; }

.field label {
  display: flex; align-items: center; justify-content: space-between;
  font-size: 13px; font-weight: 600; color: #374151;
}

.forgot {
  font-size: 12px; font-weight: 500;
  color: #2563EB; text-decoration: none;
}
.forgot:hover { text-decoration: underline; }

.input-wrap { position: relative; display: flex; align-items: center; }

.input-icon {
  position: absolute; left: 12px;
  flex-shrink: 0; pointer-events: none;
}

.input-wrap input {
  width: 100%;
  padding: 11px 40px;
  border: 1.5px solid #E2E8F0;
  border-radius: 10px;
  font-size: 14px;
  font-family: 'Plus Jakarta Sans', sans-serif;
  color: #0F172A; background: white;
  outline: none;
  transition: border-color .15s, box-shadow .15s;
}

.input-wrap input:focus {
  border-color: #2563EB;
  box-shadow: 0 0 0 3px rgba(37,99,235,.1);
}

.input-wrap input:disabled { background: #F8FAFC; cursor: not-allowed; }
.input-wrap input::placeholder { color: #CBD5E1; }

.pw-toggle {
  position: absolute; right: 12px;
  background: none; border: none; cursor: pointer;
  padding: 2px; display: flex; align-items: center;
}

/* Primary button */
.btn-primary {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  width: 100%; padding: 13px;
  background: linear-gradient(135deg, #1D4ED8, #2563EB);
  color: white; border: none; border-radius: 10px;
  font-size: 14px; font-weight: 600;
  font-family: 'Plus Jakarta Sans', sans-serif;
  cursor: pointer;
  transition: all .15s;
  box-shadow: 0 4px 14px rgba(37,99,235,.35);
  margin-top: 4px;
}

.btn-primary:hover:not(:disabled) {
  background: linear-gradient(135deg, #1e40af, #1D4ED8);
  box-shadow: 0 6px 20px rgba(37,99,235,.4);
  transform: translateY(-1px);
}

.btn-primary:disabled { opacity: .6; cursor: not-allowed; transform: none; }

/* Spinner */
.spinner {
  width: 16px; height: 16px;
  border: 2px solid rgba(255,255,255,.3);
  border-top-color: white; border-radius: 50%;
  animation: spin .6s linear infinite;
}

.spinner-dark {
  width: 16px; height: 16px;
  border: 2px solid #E2E8F0;
  border-top-color: #374151; border-radius: 50%;
  animation: spin .6s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

/* Divider */
.divider {
  display: flex; align-items: center; gap: 12px;
  margin: 24px 0;
  color: #94A3B8; font-size: 12px; font-weight: 500;
}

.divider::before, .divider::after {
  content: ''; flex: 1; height: 1px; background: #E2E8F0;
}

/* Google button */
.btn-google {
  display: flex; align-items: center; justify-content: center; gap: 10px;
  width: 100%; padding: 13px;
  background: white;
  border: 1.5px solid #E2E8F0;
  border-radius: 10px;
  font-size: 14px; font-weight: 600;
  font-family: 'Plus Jakarta Sans', sans-serif;
  color: #374151; cursor: pointer;
  transition: all .15s;
  box-shadow: 0 1px 3px rgba(0,0,0,.06);
}

.btn-google:hover:not(:disabled) {
  background: #F8FAFC;
  border-color: #CBD5E1;
  box-shadow: 0 4px 12px rgba(0,0,0,.08);
  transform: translateY(-1px);
}

.btn-google:disabled { opacity: .6; cursor: not-allowed; }

/* Info note */
.info-note {
  display: flex; align-items: flex-start; gap: 7px;
  margin-top: 16px; padding: 10px 12px;
  background: #F8FAFC; border: 1px solid #E2E8F0;
  border-radius: 8px;
  font-size: 12px; color: #64748B; line-height: 1.5;
}

.info-note strong { color: #374151; }

/* Footer */
.form-footer {
  margin-top: 28px; text-align: center;
  font-size: 11px; color: #94A3B8; letter-spacing: .3px;
}

/* Responsive */
@media (max-width: 768px) {
  .login-left { display: none; }
  .login-right { padding: 24px 16px; }
}
</style>