import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db, googleProvider } from '../firebase'
import { APPROVAL_STATUS, ROLES } from '../lib/schema'
import { api } from '../lib/callables'

const AuthContext = createContext(null)

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}

function normalizeProfile(profile) {
  if (!profile) return null
  return {
    ...profile,
    role: profile.role || ROLES.PENDING,
    approvalStatus: profile.approvalStatus || APPROVAL_STATUS.PENDING,
    assignedMinistryIds: Array.isArray(profile.assignedMinistryIds) ? profile.assignedMinistryIds : [],
  }
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null)
  const [userProfile, setUserProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  async function loadProfile(user) {
    if (!user) return null
    await api.ensureProfile()
    const snap = await getDoc(doc(db, 'users', user.uid))
    if (!snap.exists()) return null
    const profile = normalizeProfile({ id: snap.id, ...snap.data() })
    setUserProfile(profile)
    return profile
  }

  async function register(email, password, displayName) {
    const result = await createUserWithEmailAndPassword(auth, email, password)
    await updateProfile(result.user, { displayName })
    await result.user.getIdToken(true)
    await loadProfile(result.user)
    return result
  }

  async function login(email, password) {
    const result = await signInWithEmailAndPassword(auth, email, password)
    await loadProfile(result.user)
    return result
  }

  async function loginWithGoogle() {
    const result = await signInWithPopup(auth, googleProvider)
    await loadProfile(result.user)
    return result
  }

  async function refreshProfile() {
    if (!auth.currentUser) return null
    await auth.currentUser.getIdToken(true)
    return loadProfile(auth.currentUser)
  }

  async function logout() {
    setUserProfile(null)
    await signOut(auth)
  }

  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user)
      try {
        if (user) {
          await loadProfile(user)
        } else {
          setUserProfile(null)
        }
      } finally {
        setLoading(false)
      }
    })
  }, [])

  const value = useMemo(() => {
    const role = userProfile?.role || null
    const approvalStatus = userProfile?.approvalStatus || null
    return {
      currentUser,
      userProfile,
      setUserProfile,
      loading,
      role,
      approvalStatus,
      isAdmin: role === ROLES.ADMIN,
      isLeader: role === ROLES.MINISTRY_LEADER,
      isApproved: approvalStatus === APPROVAL_STATUS.APPROVED,
      isPending: approvalStatus === APPROVAL_STATUS.PENDING,
      isRejected: approvalStatus === APPROVAL_STATUS.REJECTED,
      register,
      login,
      loginWithGoogle,
      logout,
      refreshProfile,
    }
  }, [currentUser, userProfile, loading])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
