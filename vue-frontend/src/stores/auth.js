import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from 'firebase/auth'
import { auth, googleProvider } from '@/firebase'
import { authApi } from '@/services/api'

const ALLOWED_DOMAIN = import.meta.env.VITE_ALLOWED_EMAIL_DOMAIN || 'dswd.gov.ph'

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
  const role            = computed(() => profile.value?.role ?? null)

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
  const employeeNo      = computed(() => profile.value?.employeeNo     || '—')
  const position        = computed(() => profile.value?.position       || '—')
  const divisionName    = computed(() => profile.value?.divisionName   || '—')
  const divisionId      = computed(() => profile.value?.divisionId     || '')
  const positionLevel   = computed(() => profile.value?.positionLevel  || '')
  const sgLevel         = computed(() => profile.value?.sgLevel        || '')
  const employmentType  = computed(() => profile.value?.type           || 'Regular')
  const isActive        = computed(() => profile.value?.active !== false && profile.value?.active !== 'false')
  const createdAt       = computed(() => profile.value?.createdAt      || '')
  const profileId       = computed(() => profile.value?.id             || '')

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
      if (!res || !res.registered) {
        profile.value = null
        needsRegistration.value = true
      } else if (res.pending || res.active === false) {
        profile.value = res.profile || null
        needsActivation.value = true
      } else {
        profile.value = res.profile
      }
    } catch (e) {
      // Transient error (network/server). Don't misroute to registration —
      // leave the user unresolved so the guard keeps them on login.
      console.warn('[PMES] Could not resolve account status:', e.message)
      profile.value = null
    }
  }

  // ── Update local profile (after user edits profile page) ──
  function patchProfile(updates) {
    if (profile.value) {
      profile.value = { ...profile.value, ...updates }
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
      const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
        unsub()
        if (firebaseUser) {
          user.value = firebaseUser
          const profileEmail = String(profile.value?.email || '').toLowerCase()
          const loginEmail = String(firebaseUser.email || '').toLowerCase()
          if (!profile.value || profileEmail !== loginEmail) await fetchProfile()
        }
        initialised.value = true
        resolve()
      })
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

  // ── Google Sign-In ──
  async function loginWithGoogle() {
    loading.value = true
    error.value   = null
    try {
      const cred  = await signInWithPopup(auth, googleProvider)
      const email = cred.user.email
      if (!isAllowedEmail(email)) {
        await signOut(auth)
        throw new Error(`Only @${ALLOWED_DOMAIN} accounts are permitted.`)
      }
      user.value = cred.user
      await fetchProfile()
    } catch (e) {
      if (e.code === 'auth/popup-closed-by-user') {
        error.value = 'Sign-in popup was closed. Please try again.'
      } else if (e.code === 'auth/network-request-failed') {
        error.value = 'Network error. Check your connection and try again.'
      } else {
        error.value = 'Google sign-in failed. Please try again.'
      }
      throw new Error(error.value)
    } finally {
      loading.value = false
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

  return {
    // State
    user, profile, initialised, loading, error,
    needsRegistration, needsActivation,
    // Computed – auth
    isAuthenticated, hasAccess, role, fullName, initials, identity,
    // Computed – profile fields (FIX: previously missing)
    profileId, employeeNo,
    position, divisionName, divisionId,
    positionLevel, sgLevel, employmentType,
    isActive, createdAt,
    // Methods
    init, loginWithEmail, loginWithGoogle, logout,
    fetchProfile, patchProfile, register
  }
})
