import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  onAuthStateChanged
} from 'firebase/auth'
import { auth, googleProvider } from '@/firebase'
import { authApi } from '@/services/api'

const ALLOWED_DOMAIN = import.meta.env.VITE_ALLOWED_EMAIL_DOMAIN || 'dswd.gov.ph'
const BOOTSTRAP_ADMIN_EMAILS = (import.meta.env.VITE_BOOTSTRAP_ADMIN_EMAILS || 'systemadmin@dswd.gov.ph')
  .split(/[,\n|]+/)
  .map(email => email.trim().toLowerCase())
  .filter(Boolean)

const SYSTEM_ADMIN_PERMISSIONS = [
  'manage_users',
  'manage_focal_assignments',
  'manage_libraries',
  'manage_assessment_content',
  'generate_ipat_assignments',
  'manage_ipat_scores',
  'view_bureau_monitoring',
  'view_division_monitoring',
  'view_audit',
  'manage_database'
]

function canonicalRole(value) {
  const raw = String(value || '').trim()
  const key = raw.toLowerCase().replace(/[\s_-]+/g, ' ')
  const aliases = {
    'system admin': 'System Administrator',
    'system administrator': 'System Administrator',
    'admin': 'System Administrator',
    'administrator': 'System Administrator',
    'bureau director': 'Bureau Director',
    'assistant bureau director': 'Assistant Bureau Director',
    'asst bureau director': 'Assistant Bureau Director',
    'division chief': 'Division Chief',
    'section head': 'Section Head',
    'staff': 'Technical Staff',
    'technical staff': 'Technical Staff'
  }
  return aliases[key] || raw
}

function normalizeList(value) {
  if (Array.isArray(value)) return value
  return String(value || '')
    .split(/[,\n|]+/)
    .map(v => v.trim())
    .filter(Boolean)
}

function normalizeProfile(rawProfile) {
  if (!rawProfile) return null
  return {
    ...rawProfile,
    role: canonicalRole(rawProfile.role),
    officeId: rawProfile.officeId || 'STB',
    officeCode: rawProfile.officeCode || rawProfile.officeId || 'STB',
    officeName: rawProfile.officeName || 'Social Technology Bureau',
    systemScope: rawProfile.systemScope || 'STB_FULL',
    officeRole: rawProfile.officeRole || 'STB_PERSONNEL',
    centralRoles: normalizeList(rawProfile.centralRoles),
    permissionGroups: normalizeList(rawProfile.permissionGroups),
    permissions: normalizeList(rawProfile.permissions)
  }
}

export const useAuthStore = defineStore('auth', () => {
  const user        = ref(null)    // Firebase user
  const profile     = ref(null)    // PMES profile from Google Sheets
  const initialised = ref(false)
  const loading     = ref(false)
  const error       = ref(null)
  // Onboarding state: a signed-in Google user who isn't provisioned in PMES
  const needsRegistration = ref(false)   // authenticated but no PMES account → show registration
  const needsActivation   = ref(false)   // registered but awaiting admin approval → show pending

  // ── Computed ──
  const isAuthenticated = computed(() => !!user.value)
  const hasAccess       = computed(() => !!profile.value && !needsRegistration.value && !needsActivation.value)
  const role            = computed(() => canonicalRole(profile.value?.role) || null)
  const officeId        = computed(() => profile.value?.officeId || 'STB')
  const officeName      = computed(() => profile.value?.officeName || 'Social Technology Bureau')
  const systemScope     = computed(() => profile.value?.systemScope || 'STB_FULL')
  const isStbFullScope  = computed(() => systemScope.value === 'STB_FULL')
  const isClusterPortal = computed(() => ['CLUSTER_PORTAL', 'OFFICE_ADMIN', 'CLUSTER_ADMIN'].includes(systemScope.value))

  const fullName = computed(() =>
    profile.value?.fullName ||
    user.value?.displayName ||
    user.value?.email?.split('@')[0] ||
    'User'
  )

  const initials = computed(() => {
    const name = fullName.value
    return name
      .split(/\s+/)
      .filter(Boolean)
      .map(n => n[0])
      .join('')
      .toUpperCase()
  })

  // ── FIX: expose individual profile fields that views need ──
  const employeeNo      = computed(() => profile.value?.employeeNo     || '-')
  const position        = computed(() => profile.value?.position       || '-')
  const divisionName    = computed(() => profile.value?.divisionName   || '-')
  const divisionId      = computed(() => profile.value?.divisionId     || '')
  const positionLevel   = computed(() => profile.value?.positionLevel  || '')
  const sgLevel         = computed(() => profile.value?.sgLevel        || '')
  const employmentType  = computed(() => profile.value?.type           || 'Regular')
  const isActive        = computed(() => profile.value?.active !== false && profile.value?.active !== 'false')
  const createdAt       = computed(() => profile.value?.createdAt      || '')
  const profileId       = computed(() => profile.value?.id             || '')

  function isBootstrapAdminEmail(email) {
    return BOOTSTRAP_ADMIN_EMAILS.includes(String(email || '').trim().toLowerCase())
  }

  function bootstrapAdminProfile() {
    const email = user.value?.email || ''
    if (!isBootstrapAdminEmail(email)) return null
    return normalizeProfile({
      id: 'USR-842232ae8d20',
      uid: user.value?.uid || '',
      email,
      fullName: user.value?.displayName || 'System Admin',
      role: 'System Administrator',
      active: true,
      pendingActivation: false,
      permissionGroups: ['system-admin'],
      permissions: SYSTEM_ADMIN_PERMISSIONS,
      officeId: 'STB',
      officeCode: 'STB',
      officeName: 'Social Technology Bureau',
      systemScope: 'CLUSTER_ADMIN',
      officeRole: 'STB_PERSONNEL',
      centralRoles: ['CLUSTER_SYSTEM_ADMIN'],
      systemAccessMode: 'full_access'
    })
  }

  function useBootstrapAdminProfile(reason) {
    const fallback = bootstrapAdminProfile()
    if (!fallback) return false
    console.warn(`[PMES] Using bootstrap admin profile: ${reason}`)
    profile.value = fallback
    needsRegistration.value = false
    needsActivation.value = false
    return true
  }

  async function adoptFirebaseUser(firebaseUser) {
    if (!firebaseUser) return false
    if (!isAllowedEmail(firebaseUser.email)) {
      await signOut(auth)
      user.value = null
      profile.value = null
      needsRegistration.value = false
      needsActivation.value = false
      return false
    }
    user.value = firebaseUser
    await fetchProfile()
    return true
  }

  // ── Domain check ──
  function isAllowedEmail(email) {
    if (!email) return false
    if (import.meta.env.DEV) return true
    return email.endsWith(`@${ALLOWED_DOMAIN}`)
  }

  // ── Resolve onboarding state + PMES profile via Apps Script ──
  // Unregistered users are routed to self-registration; pending users to the
  // in-review screen. We no longer silently grant a fallback Staff profile.
  async function fetchProfile() {
    needsRegistration.value = false
    needsActivation.value   = false
    try {
      const res = await authApi.whoami()

      // A missing or malformed response is a TRANSPORT failure, not an answer.
      // Treating it as "not registered" showed an existing, active employee the
      // self-registration form - which is both alarming and wrong (the backend
      // would reject the submission with 409 anyway). Only an explicit
      // registered === false means the account genuinely does not exist.
      if (!res || typeof res !== 'object' || typeof res.registered === 'undefined') {
        console.warn('[PMES] whoami returned no usable payload - leaving account state unresolved.')
        if (useBootstrapAdminProfile('whoami returned no usable payload')) return
        if (!profile.value) profile.value = null
        needsRegistration.value = false
        needsActivation.value = false
        return
      }

      if (!res.registered) {
        if (useBootstrapAdminProfile('whoami did not find a PMES row')) return
        profile.value = null
        needsRegistration.value = true
        needsActivation.value = false
      } else if (res.pending || res.active === false) {
        profile.value = normalizeProfile(res.profile)
        needsActivation.value = true
      } else {
        profile.value = normalizeProfile(res.profile)
        needsRegistration.value = false
        needsActivation.value = false
      }
    } catch (e) {
      // Transient error (network/server). Don't misroute to registration -
      // leave a new user unresolved, but preserve an already-loaded profile so
      // a background refresh cannot collapse the sidebar to low-access modules.
      console.warn('[PMES] Could not resolve account status:', e.message)
      if (useBootstrapAdminProfile(e.message || 'profile request failed')) return
      if (!profile.value) profile.value = null
    }
  }

  // ── Update local profile (after user edits profile page) ──
  function patchProfile(updates) {
    if (profile.value) {
      profile.value = normalizeProfile({ ...profile.value, ...updates })
    }
  }

  // Identity from the verified Firebase user, used to prefill the registration form
  const identity = computed(() => ({
    email: user.value?.email || '',
    name:  user.value?.displayName || user.value?.email?.split('@')[0] || ''
  }))

  // ── Submit self-registration (Google-authenticated, no PMES account yet) ──
  async function register(details) {
    await authApi.register(details)
    needsRegistration.value = false
    needsActivation.value   = true   // now awaiting admin approval
  }

  // ── Init: called once by router guard ──
  function init() {
    return new Promise((resolve) => {
      let settled = false
      const finish = () => {
        if (settled) return
        settled = true
        initialised.value = true
        resolve()
      }

      ;(async () => {
        try {
          const redirectResult = await getRedirectResult(auth)
          if (redirectResult?.user) {
            await adoptFirebaseUser(redirectResult.user)
            finish()
            return
          }
        } catch (e) {
          console.warn('[PMES] Google redirect result failed:', e?.code || e?.message)
        }

        const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
          unsub()
          if (firebaseUser) await adoptFirebaseUser(firebaseUser)
          finish()
        })
      })()
    })
  }

  // ── Email / Password login ──
  async function loginWithEmail(email, password) {
    if (!isAllowedEmail(email)) {
      throw new Error(`Only @${ALLOWED_DOMAIN} accounts are permitted.`)
    }
    loading.value = true
    error.value   = null
    try {
      const cred   = await signInWithEmailAndPassword(auth, email, password)
      user.value   = cred.user
      await fetchProfile()
    } catch (e) {
      error.value = friendlyError(e.code)
      throw new Error(error.value)
    } finally {
      loading.value = false
    }
  }

  // accounts.google.com sets its own Cross-Origin-Opener-Policy on the popup it
  // opens, stricter than the "same-origin-allow-popups" this app serves. That
  // blocks Firebase's internal popup.closed heartbeat - the mechanism it uses
  // to detect someone closing the Google popup without finishing sign-in and
  // reject with auth/popup-closed-by-user, which is what triggers the redirect
  // fallback below. When that detection is blocked, signInWithPopup's promise
  // can hang indefinitely instead of rejecting: no error, no fallback, and the
  // Sign in button stays disabled with no way out short of a page refresh.
  // This timeout is a synthetic version of that same rejection so an abandoned
  // popup still reaches the existing fallback path instead of hanging forever.
  const GOOGLE_POPUP_TIMEOUT_MS = 75000

  function withPopupTimeout(promise) {
    let timer = null
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => {
        const e = new Error('Google sign-in popup timed out.')
        e.code = 'auth/popup-closed-by-user'
        reject(e)
      }, GOOGLE_POPUP_TIMEOUT_MS)
    })
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
  }

  // ── Google Sign-In ──
  async function loginWithGoogle() {
    loading.value = true
    error.value   = null
    let redirecting = false
    try {
      const cred = await withPopupTimeout(signInWithPopup(auth, googleProvider))
      const adopted = await adoptFirebaseUser(cred.user)
      if (!adopted) throw new Error(`Only @${ALLOWED_DOMAIN} accounts are permitted.`)
      return { redirected: false }
    } catch (e) {
      const popupFallbackCodes = new Set([
        'auth/popup-blocked',
        'auth/popup-closed-by-user',
        'auth/cancelled-popup-request',
        'auth/operation-not-supported-in-this-environment'
      ])

      if (popupFallbackCodes.has(e?.code)) {
        try {
          redirecting = true
          await signInWithRedirect(auth, googleProvider)
          return { redirected: true }
        } catch (redirectError) {
          console.warn('[PMES] Google redirect sign-in failed:', redirectError?.code || redirectError?.message)
          error.value = friendlyGoogleError(redirectError)
          throw new Error(error.value)
        }
      }

      console.warn('[PMES] Google popup sign-in failed:', e?.code || e?.message)
      error.value = friendlyGoogleError(e)
      throw new Error(error.value)
    } finally {
      if (!redirecting) loading.value = false
    }
  }

  // ── Logout ──
  async function logout() {
    await signOut(auth)
    user.value    = null
    profile.value = null
    needsRegistration.value = false
    needsActivation.value   = false
  }

  // ── Dead session cleanup ──
  // Firebase restores a persisted user on load even when its refresh token has
  // been revoked. isAuthenticated is just !!user, so the guard would admit that
  // user, every API call would come back 401, and nothing ever cleared it -
  // leaving the app in a state where signing in again was the only escape and
  // even that started from a poisoned baseline. Clear it properly instead.
  // Returns false (and does nothing) if a sign-in is currently in flight, so it
  // can never abort the login the user is actively performing.
  async function sessionExpired() {
    if (loading.value) return false
    try { await signOut(auth) } catch (e) { /* already signed out */ }
    user.value    = null
    profile.value = null
    needsRegistration.value = false
    needsActivation.value   = false
    return true
  }

  // ── Human-readable Firebase errors ──
  function friendlyError(code) {
    const map = {
      'auth/user-not-found':         'Invalid email or password.',
      'auth/wrong-password':         'Invalid email or password.',
      'auth/invalid-email':          'Invalid email address.',
      'auth/too-many-requests':      'Too many attempts. Please wait and try again.',
      'auth/network-request-failed': 'Network error. Check your connection.',
      'auth/invalid-credential':     'Invalid email or password.'
    }
    return map[code] || 'Sign-in failed. Please try again.'
  }

  function friendlyGoogleError(e) {
    const code = e?.code || ''
    const message = String(e?.message || '')
    if (message.includes(`Only @${ALLOWED_DOMAIN}`)) return message
    const map = {
      'auth/account-exists-with-different-credential': 'This email already uses another sign-in method. Use email/password or contact the system administrator.',
      'auth/network-request-failed': 'Network error. Check your connection and try again.',
      'auth/popup-blocked': 'Google sign-in popup was blocked. Allow popups for this site and try again.',
      'auth/popup-closed-by-user': 'Google sign-in was closed before it finished. Please try again.',
      'auth/unauthorized-domain': 'This website domain is not authorized in Firebase Authentication.',
      'auth/user-disabled': 'This Google account is disabled in Firebase. Contact the system administrator.',
      'auth/user-token-expired': 'Your Google session expired. Please try again.'
    }
    return map[code] || 'Google sign-in failed. Please try again.'
  }

  return {
    // State
    user, profile, initialised, loading, error,
    needsRegistration, needsActivation,
    // Computed - auth
    isAuthenticated, hasAccess, role, fullName, initials, identity,
    officeId, officeName, systemScope, isStbFullScope, isClusterPortal,
    // Computed - profile fields (FIX: previously missing)
    profileId, employeeNo,
    position, divisionName, divisionId,
    positionLevel, sgLevel, employmentType,
    isActive, createdAt,
    // Methods
    init, loginWithEmail, loginWithGoogle, logout, sessionExpired,
    fetchProfile, patchProfile, register
  }
})
