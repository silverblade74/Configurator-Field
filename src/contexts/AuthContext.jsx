import { createContext, useContext, useState, useEffect } from 'react'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from 'firebase/auth'
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db, googleProvider } from '../firebase'

const AuthContext = createContext()

export function useAuth() {
  return useContext(AuthContext)
}

function normalizeApprovalStatus(profile) {
  if (profile?.role === 'admin' || profile?.role === 'ministry_leader') return 'approved'
  if (profile?.approvalStatus) return profile.approvalStatus
  return 'pending'
}

function normalizeUserProfile(profile) {
  if (!profile) return null
  return {
    ...profile,
    approvalStatus: normalizeApprovalStatus(profile),
    requestedMinistryIds: Array.isArray(profile.requestedMinistryIds)
      ? profile.requestedMinistryIds
      : [],
  }
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null)
  const [userProfile, setUserProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  async function createUserProfile(user, extraData = {}) {
    const userRef = doc(db, 'users', user.uid)
    const snapshot = await getDoc(userRef)

    if (!snapshot.exists()) {
      await setDoc(userRef, {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || extraData.displayName || '',
        photoURL: user.photoURL || '',
        phone: extraData.phone || '',
        role: 'volunteer',
        ministries: [],
        totalHours: 0,
        totalPoints: 0,
        badges: [],
        streak: 0,
        lastServedDate: null,
        approvalStatus: 'pending',
        requestedMinistryIds: extraData.requestedMinistryIds || [],
        approvedBy: null,
        approvedAt: null,
        approvalNote: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    } else {
      const updates = {}
      const existing = snapshot.data()
      if (extraData.displayName && !existing.displayName) {
        updates.displayName = extraData.displayName
      }
      if (
        Array.isArray(extraData.requestedMinistryIds) &&
        extraData.requestedMinistryIds.length > 0 &&
        (!Array.isArray(existing.requestedMinistryIds) ||
          existing.requestedMinistryIds.length === 0)
      ) {
        updates.requestedMinistryIds = extraData.requestedMinistryIds
      }
      if (Object.keys(updates).length > 0) {
        updates.updatedAt = serverTimestamp()
        await setDoc(userRef, updates, { merge: true })
      }
    }

    const refreshed = await getDoc(userRef)
    return normalizeUserProfile({ id: refreshed.id, ...refreshed.data() })
  }

  async function register(email, password, displayName, requestedMinistryIds = []) {
    const result = await createUserWithEmailAndPassword(auth, email, password)
    try {
      await result.user.getIdToken(true)
      await updateProfile(result.user, { displayName })
      const profile = await createUserProfile(result.user, { displayName, requestedMinistryIds })
      setUserProfile(profile)
      return result
    } catch (err) {
      try {
        await result.user.delete()
      } catch (rollbackErr) {
        console.error('Auth rollback failed after Firestore error:', rollbackErr)
      }
      throw err
    }
  }

  async function login(email, password) {
    const result = await signInWithEmailAndPassword(auth, email, password)
    const profile = await createUserProfile(result.user)
    setUserProfile(profile)
    return result
  }

  async function loginWithGoogle() {
    const result = await signInWithPopup(auth, googleProvider)
    try {
      await result.user.getIdToken(true)
      const profile = await createUserProfile(result.user)
      setUserProfile(profile)
      return result
    } catch (err) {
      const existing = await getDoc(doc(db, 'users', result.user.uid))
      if (!existing.exists()) {
        try {
          await result.user.delete()
        } catch (rollbackErr) {
          console.error('Auth rollback failed after Firestore error:', rollbackErr)
        }
      }
      throw err
    }
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

  const approvalStatus = userProfile ? normalizeApprovalStatus(userProfile) : null
  const isApproved = approvalStatus === 'approved'
  const isPending = approvalStatus === 'pending'
  const isRejected = approvalStatus === 'rejected'

  const value = {
    currentUser,
    userProfile,
    setUserProfile,
    approvalStatus,
    isApproved,
    isPending,
    isRejected,
    register,
    login,
    loginWithGoogle,
    logout,
    loading,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
