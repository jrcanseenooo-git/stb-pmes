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

  // ── Computed ──
  const isAuthenticated = computed(() => !!user.value)
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
      .split(' ')
      .map(n => n[0])
      .join('')
      .slice(0, 2)
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

  // ── Fetch PMES profile from Google Sheets via Apps Script ──
  async function fetchProfile() {
    try {
      const data = await authApi.me()
      profile.value = data
      console.log('[PMES] Profile loaded:', data)
    } catch (e) {
      console.warn('[PMES] Could not load profile from Sheets:', e.message)
      // Minimal fallback from Firebase so the app still renders
      if (user.value) {
        profile.value = {
          id:           user.value.uid,
          uid:          user.value.uid,
          email:        user.value.email,
          fullName:     user.value.displayName || user.value.email?.split('@')[0] || 'User',
          role:         'Staff',
          divisionId:   '',
          divisionName: '',
          position:     '',
          employeeNo:   '',
          positionLevel: '',
          sgLevel:      '',
          type:         'Regular',
          active:       true,
          createdAt:    ''
        }
      }
    }
  }

  // ── Update local profile (after user edits profile page) ──
  function patchProfile(updates) {
    if (profile.value) {
      profile.value = { ...profile.value, ...updates }
    }
  }

  // ── Init: called once by router guard ──
  function init() {
    return new Promise((resolve) => {
      const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
        unsub()
        if (firebaseUser) {
          user.value = firebaseUser
          await fetchProfile()
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
      } else {
        error.value = e.message
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
  }

  // ── Human-readable Firebase errors ──
  function friendlyError(code) {
    const map = {
      'auth/user-not-found':         'No account found with this email.',
      'auth/wrong-password':         'Incorrect password. Please try again.',
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
    // Computed – auth
    isAuthenticated, role, fullName, initials,
    // Computed – profile fields (FIX: previously missing)
    profileId, employeeNo,
    position, divisionName, divisionId,
    positionLevel, sgLevel, employmentType,
    isActive, createdAt,
    // Methods
    init, loginWithEmail, loginWithGoogle, logout,
    fetchProfile, patchProfile
  }
})