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
        role: 'volunteer', // volunteer | ministry_leader | admin
        ministries: [],
        totalHours: 0,
        totalPoints: 0,
        badges: [],
        streak: 0,
        lastServedDate: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    }

    const updatedSnapshot = await getDoc(userRef)
    return { id: updatedSnapshot.id, ...updatedSnapshot.data() }
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
    const profile = await createUserProfile(result.user)
    setUserProfile(profile)
    return result
  }

  async function loginWithGoogle() {
    const result = await signInWithPopup(auth, googleProvider)
    const profile = await createUserProfile(result.user)
    setUserProfile(profile)
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

  const value = {
    currentUser,
    userProfile,
    setUserProfile,
    register,
    login,
    loginWithGoogle,
    logout,
    loading,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
