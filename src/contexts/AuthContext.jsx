import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db, googleProvider } from '../firebase'
import { api } from '../lib/callables'

const AuthContext = createContext()

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null)
  const [userProfile, setUserProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  async function createUserProfile(user, extraData = {}) {
    const displayName = user.displayName || extraData.displayName || ''

    // Call the Cloud Function to ensure profile exists server-side
    // (creates with role: 'pending', approvalStatus: 'pending' if new)
    await api.ensureProfile({ displayName })

    // Read back the profile doc to get the full data
    const userRef = doc(db, 'users', user.uid)
    const snapshot = await getDoc(userRef)
    return { id: snapshot.id, ...snapshot.data() }
  }

  async function register(email, password, displayName) {
    const result = await createUserWithEmailAndPassword(auth, email, password)
    await updateProfile(result.user, { displayName })
    const profile = await createUserProfile(result.user, { displayName })
    setUserProfile(profile)
    return result
  }

  async function login(email, password) {
    const result = await signInWithEmailAndPassword(auth, email, password)
    try {
      const profile = await createUserProfile(result.user)
      setUserProfile(profile)
    } catch (err) {
      console.error('Profile load after login failed:', err)
    }
    return result
  }

  async function loginWithGoogle() {
    const result = await signInWithPopup(auth, googleProvider)
    try {
      const profile = await createUserProfile(result.user)
      setUserProfile(profile)
    } catch (err) {
      console.error('Profile load after Google login failed:', err)
    }
    return result
  }

  function logout() {
    setUserProfile(null)
    return signOut(auth)
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user)
      if (user) {
        try {
          const profile = await createUserProfile(user)
          setUserProfile(profile)
        } catch (err) {
          console.error('Error loading user profile:', err)
        }
      } else {
        setUserProfile(null)
      }
      setLoading(false)
    })
    return unsubscribe
  }, [])

  const getPendingClaimRedirect = useCallback(() => {
    const pendingToken = localStorage.getItem('pendingClaimToken')
    if (pendingToken) return `/claim/${pendingToken}`
    return null
  }, [])

  // Computed properties derived from userProfile
  const role = userProfile?.role || 'pending'
  const approvalStatus = userProfile?.approvalStatus || 'pending'
  const isAdmin = role === 'admin'
  const isLeader = role === 'ministry_leader'
  const isApproved = approvalStatus === 'approved' || isAdmin || isLeader
  const isPending = approvalStatus === 'pending' && !isAdmin && !isLeader
  const isRejected = approvalStatus === 'rejected'

  const value = {
    currentUser, userProfile, setUserProfile,
    register, login, loginWithGoogle, logout,
    loading, getPendingClaimRedirect,
    role, approvalStatus,
    isAdmin, isLeader, isApproved, isPending, isRejected,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
