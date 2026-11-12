import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile
} from 'firebase/auth'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { auth, db } from '@/firebase/config'
import { ROLES, isBootstrapAdmin } from '@/config/roles'

const googleProvider = new GoogleAuthProvider()

function friendlyError(error) {
  const messages = {
    'auth/invalid-email': 'That email address looks invalid.',
    'auth/missing-password': 'Please enter your password.',
    'auth/weak-password': 'Your password must be at least 6 characters.',
    'auth/email-already-in-use': 'An account with this email already exists.',
    'auth/user-not-found': 'Invalid email or password.',
    'auth/wrong-password': 'Invalid email or password.',
    'auth/invalid-credential': 'Invalid email or password.',
    'auth/too-many-requests': 'Too many attempts. Please try again later.',
    'auth/popup-closed-by-user': 'Google sign-in was cancelled.',
    'auth/cancelled-popup-request': 'Google sign-in was cancelled.',
    'auth/popup-blocked': 'Your browser blocked the Google popup. Please allow popups.',
    'auth/network-request-failed': 'Network error. Please check your connection.',
    'permission-denied': 'Missing Firestore permissions. Please check your database rules.'
  }

  return messages[error?.code] || error?.message || 'Something went wrong. Please try again.'
}

function buildBaseProfile(firebaseUser, role = 'member') {
  return {
    uid: firebaseUser.uid,
    name: (firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Member').slice(0, 60),
    email: firebaseUser.email || '',
    photoURL: firebaseUser.photoURL || '',
    role
  }
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  const profile = ref(null)
  const loading = ref(true)
  const initialized = ref(false)
  const error = ref('')

  let initPromise = null

  const isAuthenticated = computed(() => !!user.value)
  const displayName = computed(
    () => profile.value?.name || user.value?.displayName || user.value?.email || 'Member'
  )
  const role = computed(() => profile.value?.role || 'member')
  const isAdmin = computed(
    () => role.value === 'admin' || isBootstrapAdmin(user.value?.email)
  )
  const isParent = computed(() => role.value === 'parent')
  const canManageRules = computed(() => isAdmin.value || isParent.value)
  const initial = computed(() => displayName.value.charAt(0).toUpperCase())

  async function ensureProfile(firebaseUser) {
    const userRef = doc(db, 'users', firebaseUser.uid)
    const snapshot = await getDoc(userRef)
    const bootstrapAdmin = isBootstrapAdmin(firebaseUser.email)
    const base = buildBaseProfile(firebaseUser, bootstrapAdmin ? 'admin' : 'member')

    if (snapshot.exists()) {
      const data = snapshot.data()
      const existingRole = ROLES.includes(data.role) ? data.role : 'member'
      const merged = {
        ...data,
        uid: firebaseUser.uid,
        name: (firebaseUser.displayName || data.name || base.name).slice(0, 60),
        email: firebaseUser.email || data.email || '',
        photoURL: firebaseUser.photoURL || data.photoURL || '',
        role: bootstrapAdmin ? 'admin' : existingRole
      }

      profile.value = merged

      const updates = {
        name: merged.name,
        email: merged.email,
        photoURL: merged.photoURL,
        lastLoginAt: serverTimestamp()
      }
      if (bootstrapAdmin) updates.role = 'admin'

      await setDoc(userRef, updates, { merge: true })
    } else {
      profile.value = base

      await setDoc(userRef, {
        ...base,
        createdAt: serverTimestamp(),
        lastLoginAt: serverTimestamp()
      })
    }
  }

  function syncProfile(firebaseUser) {
    return ensureProfile(firebaseUser).catch((err) => {
      console.error('Failed to sync Firestore profile:', err)
      profile.value = buildBaseProfile(
        firebaseUser,
        isBootstrapAdmin(firebaseUser.email) ? 'admin' : 'member'
      )
    })
  }

  async function register(name, email, password) {
    error.value = ''

    try {
      const credential = await createUserWithEmailAndPassword(auth, email, password)
      if (name) await updateProfile(credential.user, { displayName: name })
      user.value = credential.user
      await syncProfile(credential.user)
      return credential.user
    } catch (err) {
      error.value = friendlyError(err)
      throw err
    }
  }

  async function login(email, password) {
    error.value = ''

    try {
      const credential = await signInWithEmailAndPassword(auth, email, password)
      user.value = credential.user
      await syncProfile(credential.user)
      return credential.user
    } catch (err) {
      error.value = friendlyError(err)
      throw err
    }
  }

  async function loginWithGoogle() {
    error.value = ''

    try {
      const credential = await signInWithPopup(auth, googleProvider)
      user.value = credential.user
      await syncProfile(credential.user)
      return credential.user
    } catch (err) {
      error.value = friendlyError(err)
      throw err
    }
  }

  async function logout() {
    error.value = ''

    try {
      await signOut(auth)
    } finally {
      user.value = null
      profile.value = null
    }
  }

  function init() {
    if (initPromise) return initPromise

    initPromise = new Promise((resolve) => {
      onAuthStateChanged(auth, async (firebaseUser) => {
        user.value = firebaseUser

        if (firebaseUser) {
          await syncProfile(firebaseUser)
        } else {
          profile.value = null
        }

        loading.value = false
        initialized.value = true
        resolve()
      })
    })

    return initPromise
  }

  return {
    user,
    profile,
    loading,
    initialized,
    error,
    isAuthenticated,
    isAdmin,
    isParent,
    canManageRules,
    displayName,
    role,
    initial,
    init,
    register,
    login,
    loginWithGoogle,
    logout
  }
})
