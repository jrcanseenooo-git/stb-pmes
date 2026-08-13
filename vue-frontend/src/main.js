import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import Toast from 'vue-toastification'
import './assets/fonts.css'
// Additive-only, hand-written CSS scoped to `pui-` prefixed classes for the
// multi-office portal modules. Deliberately NOT importing assets/main.css —
// its Tailwind preflight/base layer has never been active and would alter
// every existing hand-styled screen; see git history on this file.
import './assets/ui-kit.css'
import 'vue-toastification/dist/index.css'

if (import.meta.env.PROD) {
  console.warn = () => {}
  console.error = () => {}
}

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.use(Toast)
app.mount('#app')

function hideBootSplash() {
  const splash = document.getElementById('pmes-boot-splash')
  if (!splash) return
  splash.classList.add('pmes-boot-splash-hide')
  window.setTimeout(() => splash.remove(), 280)
}

function updateBootSplash(message) {
  const copy = document.getElementById('pmes-boot-copy')
  if (!copy) return
  copy.textContent = message
}

// router.isReady() is the fast, correct signal — but a splash whose only exit
// is a single promise is a splash that can get stuck forever the moment that
// promise misbehaves for any reason, and it was: production was confirmed
// showing this splash indefinitely over already-rendered pages, blocking
// every click underneath it (position:fixed + full-viewport + no
// pointer-events:none until the hide class lands). Two independent,
// idempotent fallbacks — the window 'load' event and a hard cap — guarantee
// the splash cannot outlive the app being visibly ready, regardless of what
// router.isReady() is doing.
router.isReady().catch(() => {}).finally(hideBootSplash)
window.addEventListener('load', hideBootSplash)
window.setTimeout(hideBootSplash, 3000)

window.setTimeout(() => {
  updateBootSplash('Still loading your workspace. This can take a little longer after a refresh.')
}, 8000)

window.addEventListener('error', () => {
  updateBootSplash('The app is taking longer than expected. Please refresh if this message stays on screen.')
})

window.addEventListener('unhandledrejection', () => {
  updateBootSplash('The app is taking longer than expected. Please refresh if this message stays on screen.')
})

// When Firebase can no longer refresh the ID token the session is dead, and
// every subsequent request would fail with "Unauthorized". Send the user to
// sign in once instead of letting the failures pile up on screen. Guarded so a
// burst of concurrent calls cannot trigger a redirect loop.
// The sign-in route is /auth/login — it lives under the /auth layout, which is
// what the router's own guard redirects to. '/login' does not exist and lands on
// the 404 page.
const LOGIN_PATH = '/auth/login'

let handlingAuthExpiry = false
window.addEventListener('pmes:auth-expired', async () => {
  if (handlingAuthExpiry) return
  const current = router.currentRoute.value
  // Already on an onboarding page (login / register / pending) — nothing to do.
  // In particular this must not fire while the user is signing in.
  if (current.path.startsWith('/auth')) return
  handlingAuthExpiry = true
  try {
    // Clear the dead Firebase session first. Without this the restored user
    // object keeps isAuthenticated true, the guard readmits them, and the 401s
    // resume immediately. sessionExpired() no-ops if a sign-in is in flight.
    const { useAuthStore } = await import('@/stores/auth')
    await useAuthStore().sessionExpired()
    const redirect = current.fullPath
    // LoginView reads ?redirect to return the user here after signing in; the
    // guard keeps only values starting with a single '/', which a fullPath does.
    await router.replace({
      path: LOGIN_PATH,
      query: redirect && redirect !== '/' ? { redirect } : {}
    })
  } catch (e) {
    /* navigation aborted or store unavailable — the redirect is best-effort */
  } finally {
    setTimeout(() => { handlingAuthExpiry = false }, 2000)
  }
})
