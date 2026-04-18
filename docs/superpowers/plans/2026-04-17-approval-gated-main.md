# Approval-Gated Volunteer Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `pending → approved/rejected` approval gate to the live volunteer app on `main` so self-registered users cannot create event signups until an admin or scoped ministry leader approves them.

**Architecture:** Existing Firebase/Firestore schema is extended with `approvalStatus`, `requestedMinistryIds`, and approval-tracking fields on `/users` docs. A client-side `normalizeApprovalStatus` provides a legacy fallback so admins/leaders in pre-migration production data are treated as approved while volunteers fall through to pending. Route guards, UI surfaces (AdminDashboard + LeaderDashboard Pending Approvals card, PendingApproval page, ministry-interest selector in Register), and Firestore rules enforce the gate end-to-end. A one-time local migration script backfills `approvalStatus` on existing docs so the new rules evaluate consistently.

**Tech Stack:** React 18 + Vite, Firebase Auth (email/password + Google), Firestore, Tailwind, React Router v6, lucide-react, firebase-admin (migration script only).

**Base:** Plan runs from a worktree rooted at `<worktree-root>` (the repo root; no `church-volunteer-app/` subdirectory on main). Branch: `feature/approval-gated` created from `main` via `using-git-worktrees`.

**Verification convention:** Project has no automated test suite. Every task's verification is `npm.cmd run build` from the worktree root plus manual review by the reviewer subagent. Firestore rules compile-check happens in Task 14 via `firebase deploy --only firestore:rules --dry-run` if available, otherwise by rule inspection only — the rules are NOT deployed during plan execution. The migration script is NOT run during plan execution. Both are the user's to run after merge (see Task 17).

**Spec:** `docs/superpowers/specs/2026-04-17-approval-gated-main-design.md`.

---

### Task 1: Baseline install and build

**Files:** none changed

- [ ] **Step 1: Install dependencies**

```powershell
npm.cmd install
```

Expected: completes without error (peer-dep warnings acceptable).

- [ ] **Step 2: Baseline build**

```powershell
npm.cmd run build
```

Expected: PASS. Note any pre-existing warnings so you can distinguish new ones.

- [ ] **Step 3: Record baseline HEAD**

```powershell
git rev-parse HEAD
```

Note the SHA. All subsequent task diffs should be relative to this.

---

### Task 2: AuthContext — approval helpers, legacy fallback, orphan rollback

**Files:**
- Modify: `src/contexts/AuthContext.jsx`

- [ ] **Step 1: Replace the entire `AuthContext.jsx` file body with the version below**

Read `src/contexts/AuthContext.jsx` first to confirm its current shape (it's ~90 lines). Replace the file with:

```jsx
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
```

- [ ] **Step 2: Build**

```powershell
npm.cmd run build
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/contexts/AuthContext.jsx
git commit -m "Add approval-status defaults and orphan rollback to AuthContext"
```

---

### Task 3: Reusable Notice component

**Files:**
- Create: `src/components/Notice.jsx`

- [ ] **Step 1: Create the file**

```jsx
import { CheckCircle2, Info, AlertTriangle, XCircle } from 'lucide-react'

const styles = {
  info: { wrap: 'bg-blue-50 text-blue-800 border-blue-200', Icon: Info },
  success: { wrap: 'bg-green-50 text-green-800 border-green-200', Icon: CheckCircle2 },
  warning: { wrap: 'bg-amber-50 text-amber-800 border-amber-200', Icon: AlertTriangle },
  error: { wrap: 'bg-red-50 text-red-800 border-red-200', Icon: XCircle },
}

export default function Notice({ type = 'info', title, children }) {
  const { wrap, Icon } = styles[type] || styles.info
  const role = type === 'error' ? 'alert' : 'status'
  const ariaLive = type === 'error' ? undefined : 'polite'
  return (
    <div role={role} aria-live={ariaLive} className={`flex gap-2 items-start rounded-lg border p-3 text-sm ${wrap}`}>
      <Icon size={18} className="shrink-0 mt-0.5" />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        <div>{children}</div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Build**

```powershell
npm.cmd run build
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/Notice.jsx
git commit -m "Add reusable Notice component for inline status messages"
```

---

### Task 4: ProtectedRoute — requireApproved and allowPending

**Files:**
- Modify: `src/components/ProtectedRoute.jsx`

- [ ] **Step 1: Replace the file**

```jsx
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function ProtectedRoute({ children, requiredRole, requireApproved = false, allowPending = false }) {
  const { currentUser, userProfile, approvalStatus, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />
  }

  if (requiredRole) {
    const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole]
    if (!roles.includes(userProfile?.role)) {
      return <Navigate to="/dashboard" replace />
    }
  }

  if (requireApproved && approvalStatus !== 'approved') {
    return <Navigate to={approvalStatus === 'rejected' ? '/profile' : '/pending-approval'} replace />
  }

  if (allowPending && approvalStatus === 'approved') {
    return <Navigate to="/dashboard" replace />
  }

  return children
}
```

- [ ] **Step 2: Build**

```powershell
npm.cmd run build
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/ProtectedRoute.jsx
git commit -m "Add requireApproved and allowPending props to ProtectedRoute"
```

---

### Task 5: PendingApproval page

**Files:**
- Create: `src/pages/PendingApproval.jsx`

- [ ] **Step 1: Create the file**

```jsx
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import Notice from '../components/Notice'
import { Calendar, Users, LogOut } from 'lucide-react'

export default function PendingApproval() {
  const { userProfile, approvalStatus, logout } = useAuth()
  const displayName = userProfile?.displayName || 'there'
  const note = userProfile?.approvalNote || ''

  return (
    <div className="max-w-xl mx-auto py-12 px-4 space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Thanks for registering, {displayName}!</h1>
      </div>

      {approvalStatus === 'rejected' ? (
        <Notice type="error" title="Your account was not approved">
          {note ? <p>Reason: {note}</p> : <p>Please contact a church admin for next steps.</p>}
        </Notice>
      ) : (
        <Notice type="info" title="Account pending review">
          An admin or ministry leader will review your request. You can browse events and ministries while you wait.
        </Notice>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Link to="/events" className="card flex items-center gap-2 hover:bg-gray-50">
          <Calendar size={18} />
          <span>Browse events</span>
        </Link>
        <Link to="/ministries" className="card flex items-center gap-2 hover:bg-gray-50">
          <Users size={18} />
          <span>Browse ministries</span>
        </Link>
      </div>

      <button
        onClick={() => logout()}
        className="btn-secondary w-full flex items-center justify-center gap-2"
      >
        <LogOut size={16} /> Sign out
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Build**

```powershell
npm.cmd run build
```

Expected: PASS. (The route isn't wired yet; it's wired in Task 6.)

- [ ] **Step 3: Commit**

```bash
git add src/pages/PendingApproval.jsx
git commit -m "Add PendingApproval landing page"
```

---

### Task 6: App.jsx — wire routes and gates

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Replace the file**

```jsx
import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Register from './pages/Register'
import PendingApproval from './pages/PendingApproval'
import VolunteerDashboard from './pages/VolunteerDashboard'
import Events from './pages/Events'
import Ministries from './pages/Ministries'
import Leaderboard from './pages/Leaderboard'
import Badges from './pages/Badges'
import Profile from './pages/Profile'
import AdminDashboard from './pages/AdminDashboard'
import LeaderDashboard from './pages/LeaderDashboard'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route element={
        <ProtectedRoute>
          <Layout />
        </ProtectedRoute>
      }>
        <Route path="/pending-approval" element={
          <ProtectedRoute allowPending>
            <PendingApproval />
          </ProtectedRoute>
        } />
        <Route path="/dashboard" element={
          <ProtectedRoute requireApproved>
            <VolunteerDashboard />
          </ProtectedRoute>
        } />
        <Route path="/events" element={<Events />} />
        <Route path="/ministries" element={<Ministries />} />
        <Route path="/leaderboard" element={
          <ProtectedRoute requireApproved>
            <Leaderboard />
          </ProtectedRoute>
        } />
        <Route path="/badges" element={
          <ProtectedRoute requireApproved>
            <Badges />
          </ProtectedRoute>
        } />
        <Route path="/profile" element={<Profile />} />
        <Route path="/leaders" element={
          <ProtectedRoute requiredRole={['admin', 'ministry_leader']}>
            <LeaderDashboard />
          </ProtectedRoute>
        } />
        <Route path="/admin" element={
          <ProtectedRoute requiredRole={['admin']}>
            <AdminDashboard />
          </ProtectedRoute>
        } />
      </Route>

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
```

Note: `/pending-approval` sits inside the `<Layout />` outlet so the Navbar still renders; `allowPending` redirects approved users to `/dashboard` automatically.

- [ ] **Step 2: Build**

```powershell
npm.cmd run build
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/App.jsx
git commit -m "Wire /pending-approval and gate approved-only routes"
```

---

### Task 7: Navbar — hide approved-only links for pending users, add status link

**Files:**
- Modify: `src/components/Navbar.jsx`

- [ ] **Step 1: Replace the file**

```jsx
import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Menu, X, LogOut, User, LayoutDashboard, Calendar, Users, Trophy, Award, ClipboardList, Clock } from 'lucide-react'

export default function Navbar() {
  const { currentUser, userProfile, isApproved, isPending, isRejected, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)

  const isAdmin = userProfile?.role === 'admin'
  const isLeader = userProfile?.role === 'ministry_leader'

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  const navLinks = []
  if (isApproved) {
    navLinks.push({ to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard })
  }
  navLinks.push({ to: '/events', label: 'Events', icon: Calendar })
  navLinks.push({ to: '/ministries', label: 'Ministries', icon: Users })
  if (isApproved) {
    navLinks.push({ to: '/leaderboard', label: 'Leaderboard', icon: Trophy })
    navLinks.push({ to: '/badges', label: 'Badges', icon: Award })
  }
  if (isPending || isRejected) {
    navLinks.unshift({
      to: '/pending-approval',
      label: isRejected ? 'Account not approved' : 'Pending review',
      icon: Clock,
    })
  }
  if (isAdmin || isLeader) {
    navLinks.push({ to: '/leaders', label: 'Leaders', icon: ClipboardList })
  }
  if (isAdmin) {
    navLinks.push({ to: '/admin', label: 'Admin', icon: LayoutDashboard })
  }

  const isActive = (path) => location.pathname === path

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link to={isApproved ? '/dashboard' : '/pending-approval'} className="flex items-center space-x-2">
              <span className="text-2xl">\u26EA</span>
              <span className="font-bold text-lg text-primary-700 hidden sm:block">VolunteerHub</span>
            </Link>
            {currentUser && (
              <div className="hidden md:flex ml-8 space-x-1">
                {navLinks.map((link) => (
                  <Link key={link.to} to={link.to} className={`flex items-center space-x-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${isActive(link.to) ? 'bg-primary-50 text-primary-700' : 'text-gray-600 hover:bg-gray-100'}`}>
                    <link.icon size={16} /><span>{link.label}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center space-x-3">
            {currentUser ? (
              <>
                <Link to="/profile" className="hidden sm:flex items-center space-x-2 text-sm text-gray-600 hover:text-gray-900">
                  <User size={16} /><span>{userProfile?.displayName || currentUser.email}</span>
                </Link>
                <button onClick={handleLogout} className="text-gray-500 hover:text-gray-700 p-2"><LogOut size={18} /></button>
                <button className="md:hidden p-2" onClick={() => setMobileOpen(!mobileOpen)}>{mobileOpen ? <X size={20} /> : <Menu size={20} />}</button>
              </>
            ) : (
              <div className="flex space-x-2">
                <Link to="/login" className="btn-secondary text-sm">Log In</Link>
                <Link to="/register" className="btn-primary text-sm">Sign Up</Link>
              </div>
            )}
          </div>
        </div>
      </div>
      {mobileOpen && currentUser && (
        <div className="md:hidden border-t border-gray-200 bg-white">
          <div className="px-4 py-3 space-y-1">
            {navLinks.map((link) => (
              <Link key={link.to} to={link.to} onClick={() => setMobileOpen(false)} className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium ${isActive(link.to) ? 'bg-primary-50 text-primary-700' : 'text-gray-600 hover:bg-gray-100'}`}>
                <link.icon size={16} /><span>{link.label}</span>
              </Link>
            ))}
            <Link to="/profile" onClick={() => setMobileOpen(false)} className="flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100">
              <User size={16} /><span>Profile</span>
            </Link>
          </div>
        </div>
      )}
    </nav>
  )
}
```

- [ ] **Step 2: Build**

```powershell
npm.cmd run build
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/Navbar.jsx
git commit -m "Hide approved-only nav links for pending users and link to status"
```

---

### Task 8: Register — ministry interest + approval notice

**Files:**
- Modify: `src/pages/Register.jsx`

- [ ] **Step 1: Replace the file**

```jsx
import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Church } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { getMinistries } from '../services/firestore'
import Notice from '../components/Notice'

export default function Register() {
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [ministries, setMinistries] = useState([])
  const [requestedMinistryIds, setRequestedMinistryIds] = useState([])
  const [ministriesLoading, setMinistriesLoading] = useState(true)
  const [ministriesError, setMinistriesError] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { register, loginWithGoogle } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    async function load() {
      try {
        setMinistriesLoading(true)
        setMinistries(await getMinistries())
      } catch (err) {
        setMinistriesError('We could not load ministries right now.')
        setMinistries([])
      } finally {
        setMinistriesLoading(false)
      }
    }
    load()
  }, [])

  function toggleMinistry(id) {
    setRequestedMinistryIds((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
    )
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (password !== confirmPassword) return setError('Passwords do not match')
    if (password.length < 6) return setError('Password must be at least 6 characters')

    setError('')
    setLoading(true)
    try {
      await register(email, password, displayName, requestedMinistryIds)
      navigate('/pending-approval')
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') {
        setError('An account with this email already exists')
      } else {
        setError('Failed to create account. Please try again.')
      }
    }
    setLoading(false)
  }

  async function handleGoogle() {
    setError('')
    try {
      await loginWithGoogle()
      navigate('/pending-approval')
    } catch (err) {
      setError('Failed to sign up with Google.')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <Church className="mx-auto text-primary-700" size={48} />
          <h1 className="text-2xl font-bold mt-4">Join VolunteerHub</h1>
          <p className="text-gray-500 mt-1">Create your volunteer account</p>
        </div>

        <div className="card space-y-4">
          <Notice type="info" title="Approval required">
            After creating your account, an admin or ministry leader will review your request before event signup is enabled.
          </Notice>

          {error && <Notice type="error">{error}</Notice>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Full Name</label>
              <input type="text" className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required placeholder="John Doe" />
            </div>
            <div>
              <label className="label">Email</label>
              <input type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="your@email.com" />
            </div>
            <div>
              <label className="label">Password</label>
              <input type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="At least 6 characters" />
            </div>
            <div>
              <label className="label">Confirm Password</label>
              <input type="password" className="input" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required placeholder="Confirm your password" />
            </div>
            {ministriesLoading ? (
              <Notice type="info" title="Loading ministries">You can still create your account while ministries load.</Notice>
            ) : ministriesError ? (
              <Notice type="warning" title="Ministries unavailable">{ministriesError} You can still create your account without selecting any ministries.</Notice>
            ) : ministries.length === 0 ? (
              <Notice type="info" title="No ministries listed">There are no ministries to select from right now. You can still create your account.</Notice>
            ) : (
              <div>
                <label className="label">Ministries you are interested in (optional)</label>
                <div className="grid gap-2">
                  {ministries.map((m) => (
                    <label key={m.id} className="flex items-start gap-2 rounded-lg border border-gray-200 p-2 text-sm">
                      <input
                        type="checkbox"
                        checked={requestedMinistryIds.includes(m.id)}
                        onChange={() => toggleMinistry(m.id)}
                        className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-primary-600"
                      />
                      <span className="min-w-0 flex-1 break-words">{m.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-white px-4 text-gray-400">or</span>
            </div>
          </div>

          <button
            onClick={handleGoogle}
            className="w-full flex items-center justify-center space-x-2 border border-gray-300 rounded-lg px-4 py-2 hover:bg-gray-50 transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            <span className="text-sm font-medium text-gray-700">Continue with Google</span>
          </button>

          <p className="text-center text-sm text-gray-500 mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-primary-600 font-medium hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Build**

```powershell
npm.cmd run build
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/pages/Register.jsx
git commit -m "Collect ministry interests during registration and route to pending approval"
```

---

### Task 9: Events — browse-only for unapproved users

**Files:**
- Modify: `src/pages/Events.jsx`

- [ ] **Step 1: Patch the imports**

Replace the existing import line `import EmptyState from '../components/EmptyState'` with:

```jsx
import EmptyState from '../components/EmptyState'
import Notice from '../components/Notice'
```

- [ ] **Step 2: Destructure `isApproved` from `useAuth`**

Replace:

```jsx
const { userProfile } = useAuth()
```

with:

```jsx
const { userProfile, isApproved } = useAuth()
```

- [ ] **Step 3: Add a `message` state for inline errors**

Immediately after `const [actionLoading, setActionLoading] = useState(null)`, add:

```jsx
const [message, setMessage] = useState(null)
```

- [ ] **Step 4: Replace `handleSignUp` and `handleCancel`**

Replace both handlers with versions that surface errors via `Notice` instead of `alert`:

```jsx
async function handleSignUp(eventId) {
  setActionLoading(eventId)
  setMessage(null)
  try {
    await signUpForEvent(eventId, userProfile.uid, userProfile.displayName)
    setMessage({ type: 'success', text: 'Signed up.' })
    await loadData()
  } catch (err) {
    setMessage({ type: 'error', text: err.message || 'Failed to sign up.' })
  }
  setActionLoading(null)
}

async function handleCancel(eventId) {
  const signup = userSignups.find((s) => s.eventId === eventId)
  if (!signup) return
  setActionLoading(eventId)
  setMessage(null)
  try {
    await cancelSignup(signup.id, eventId)
    setMessage({ type: 'success', text: 'Signup cancelled.' })
    await loadData()
  } catch (err) {
    setMessage({ type: 'error', text: 'Failed to cancel signup.' })
  }
  setActionLoading(null)
}
```

- [ ] **Step 5: Render the `message` banner at the top of the returned JSX**

In the returned JSX, immediately after `<div className="space-y-6">`, insert:

```jsx
{message && <Notice type={message.type}>{message.text}</Notice>}
```

- [ ] **Step 6: Replace the signup button block inside the event card**

The existing `!isPast && ( ... signed ? cancel : signup )` block becomes:

```jsx
{!isPast && (
  <div className="mt-4">
    {!isApproved ? (
      <button className="btn-secondary w-full" disabled>
        Approval required
      </button>
    ) : signed ? (
      <button onClick={() => handleCancel(event.id)} disabled={actionLoading === event.id} className="btn-secondary w-full flex items-center justify-center space-x-1">
        <X size={14} /><span>{actionLoading === event.id ? 'Cancelling...' : 'Cancel Signup'}</span>
      </button>
    ) : (
      <button onClick={() => handleSignUp(event.id)} disabled={actionLoading === event.id || (event.maxVolunteers && event.signupCount >= event.maxVolunteers)} className="btn-primary w-full">
        {actionLoading === event.id ? 'Signing up...' : 'Sign Up'}
      </button>
    )}
  </div>
)}
```

- [ ] **Step 7: Build**

```powershell
npm.cmd run build
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/pages/Events.jsx
git commit -m "Events: disable signup for unapproved users and surface inline messages"
```

---

### Task 10: Profile — status banner + inline messages

**Files:**
- Modify: `src/pages/Profile.jsx`

- [ ] **Step 1: Update imports**

Add two imports at the top:

```jsx
import Notice from '../components/Notice'
```

Change the `useAuth` destructure to also include approval flags:

```jsx
const { currentUser, userProfile, setUserProfile, approvalStatus, isApproved } = useAuth()
```

- [ ] **Step 2: Add `message` state and refactor `handleSave`**

Add:

```jsx
const [message, setMessage] = useState(null)
```

Replace `handleSave` with:

```jsx
async function handleSave() {
  setSaving(true)
  setMessage(null)
  try {
    await updateDoc(doc(db, 'users', userProfile.id), {
      displayName,
      phone,
      updatedAt: serverTimestamp(),
    })
    setUserProfile((prev) => ({ ...prev, displayName, phone }))
    setEditing(false)
    setMessage({ type: 'success', text: 'Profile updated.' })
  } catch (err) {
    setMessage({ type: 'error', text: 'Failed to update profile.' })
  }
  setSaving(false)
}
```

Note: writes use `userProfile.id` (the doc ID, which equals `currentUser.uid` for self-registered users and differs for managed volunteers).

- [ ] **Step 3: Render banners below the title**

Immediately after `<h1 className="text-2xl font-bold">My Profile</h1>`, insert:

```jsx
{message && <Notice type={message.type}>{message.text}</Notice>}
{approvalStatus && approvalStatus !== 'approved' && (
  <Notice type={approvalStatus === 'rejected' ? 'error' : 'info'} title="Account status">
    Your account status is {approvalStatus}. Event signup unlocks after approval.
    {userProfile?.approvalNote && <span className="block mt-1 text-xs">Note: {userProfile.approvalNote}</span>}
  </Notice>
)}
```

- [ ] **Step 4: Hide gamification stats for unapproved users**

Wrap the `<div className="grid grid-cols-3 gap-4">` stats block with `{isApproved && ( ... )}`:

```jsx
{isApproved && (
  <div className="grid grid-cols-3 gap-4">
    <div className="card text-center">
      <Clock size={20} className="mx-auto text-primary-500 mb-1" />
      <p className="text-xl font-bold">{formatHours(userProfile?.totalHours || 0)}</p>
      <p className="text-xs text-gray-500">Hours Served</p>
    </div>
    <div className="card text-center">
      <Star size={20} className="mx-auto text-orange-500 mb-1" />
      <p className="text-xl font-bold">{userProfile?.totalPoints || 0}</p>
      <p className="text-xs text-gray-500">Points</p>
    </div>
    <div className="card text-center">
      <Award size={20} className="mx-auto text-purple-500 mb-1" />
      <p className="text-xl font-bold">{(userProfile?.badges || []).length}</p>
      <p className="text-xs text-gray-500">Badges</p>
    </div>
  </div>
)}
```

- [ ] **Step 5: Build**

```powershell
npm.cmd run build
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/pages/Profile.jsx
git commit -m "Profile: show approval status and hide stats for unapproved users"
```

---

### Task 11: Firestore service — approval helpers

**Files:**
- Modify: `src/services/firestore.js`

- [ ] **Step 1: Verify needed imports**

Open `src/services/firestore.js`. Confirm these are imported from `firebase/firestore`: `collection`, `doc`, `getDocs`, `query`, `where`, `updateDoc`, `serverTimestamp`. Add any that are missing (most should already be present).

- [ ] **Step 2: Append the three helpers**

Append at the bottom of `firestore.js`:

```jsx
export async function getPendingUsersForReviewer(reviewerProfile) {
  const q = query(
    collection(db, 'users'),
    where('approvalStatus', '==', 'pending')
  )
  const snap = await getDocs(q)
  const users = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0))

  if (reviewerProfile?.role === 'admin') return users

  const reviewerMinistries = reviewerProfile?.ministries || []
  if (reviewerProfile?.role !== 'ministry_leader' || reviewerMinistries.length === 0) {
    return []
  }

  return users.filter((u) =>
    (u.requestedMinistryIds || []).some((id) => reviewerMinistries.includes(id))
  )
}

export async function approveUser(userId, reviewerUid) {
  return updateDoc(doc(db, 'users', userId), {
    approvalStatus: 'approved',
    approvedBy: reviewerUid,
    approvedAt: serverTimestamp(),
    approvalNote: '',
    updatedAt: serverTimestamp(),
  })
}

export async function rejectUser(userId, reviewerUid, approvalNote = '') {
  return updateDoc(doc(db, 'users', userId), {
    approvalStatus: 'rejected',
    approvedBy: reviewerUid,
    approvedAt: serverTimestamp(),
    approvalNote,
    updatedAt: serverTimestamp(),
  })
}
```

- [ ] **Step 3: Build**

```powershell
npm.cmd run build
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/services/firestore.js
git commit -m "Add approval query and mutation helpers"
```

---

### Task 12: Managed volunteer — auto-approved on creation

**Files:**
- Modify: `src/services/firestore.js`
- Modify: `src/pages/AdminDashboard.jsx`

- [ ] **Step 1: Update `createManagedVolunteer` signature and body**

In `src/services/firestore.js`, locate `export async function createManagedVolunteer({ displayName, email, phone }) {` (around line 228). Replace the entire function with:

```jsx
export async function createManagedVolunteer({ displayName, email, phone, requestedMinistryIds = [] }, adminUid) {
  const ref = await addDoc(collection(db, 'users'), {
    uid: null,
    email: email || '',
    displayName: displayName || '',
    photoURL: '',
    phone: phone || '',
    role: 'volunteer',
    managed: true,
    ministries: [],
    requestedMinistryIds,
    totalHours: 0,
    totalPoints: 0,
    badges: [],
    streak: 0,
    lastServedDate: null,
    approvalStatus: 'approved',
    approvedBy: adminUid || null,
    approvedAt: serverTimestamp(),
    approvalNote: '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref
}
```

- [ ] **Step 2: Update the caller in AdminDashboard**

In `src/pages/AdminDashboard.jsx`, locate the `createManagedVolunteer(volunteerForm)` call (around line 334). Replace with:

```jsx
await createManagedVolunteer(volunteerForm, userProfile?.uid)
```

`userProfile` is already destructured from `useAuth()` in AdminDashboard — verify by scanning the top of the file.

- [ ] **Step 3: Build**

```powershell
npm.cmd run build
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/services/firestore.js src/pages/AdminDashboard.jsx
git commit -m "Auto-approve managed volunteers on creation"
```

---

### Task 13: AdminDashboard — Pending Approvals card on Overview tab

**Files:**
- Modify: `src/pages/AdminDashboard.jsx`

- [ ] **Step 1: Update imports**

Add to the existing `../services/firestore` import block:

```jsx
getPendingUsersForReviewer,
approveUser,
rejectUser,
```

Add a new import line:

```jsx
import Notice from '../components/Notice'
```

- [ ] **Step 2: Add state for approvals**

Near other `useState` declarations, add:

```jsx
const [pendingUsers, setPendingUsers] = useState([])
const [approvalLoading, setApprovalLoading] = useState(null)
const [message, setMessage] = useState(null)
```

- [ ] **Step 3: Load pending users in `loadData`**

Update the Promise.all in `loadData` to include the pending-users query. Currently `loadData` awaits `[getAllUsers(), getEvents(), getMinistries(), getServiceHoursSummary()]`. Change to `Promise.allSettled` with an extra entry and pick results defensively (one failing query should not wipe all data):

```jsx
async function loadData() {
  const results = await Promise.allSettled([
    getAllUsers(),
    getEvents(),
    getMinistries(),
    getServiceHoursSummary(),
    getPendingUsersForReviewer(userProfile),
  ])
  const [usersRes, eventsRes, ministriesRes, hoursRes, pendingRes] = results
  const pick = (res, fallback, label) => {
    if (res.status === 'fulfilled') return res.value
    console.error(`Error loading ${label}:`, res.reason)
    return fallback
  }
  setUsers(pick(usersRes, [], 'users'))
  setEvents(pick(eventsRes, [], 'events'))
  setMinistries(pick(ministriesRes, [], 'ministries'))
  setServiceHours(pick(hoursRes, [], 'service hours'))
  setPendingUsers(pick(pendingRes, [], 'pending users'))
  setLoading(false)
}
```

- [ ] **Step 4: Add approval handlers**

Add after the existing role-change or nearby user-management handlers:

```jsx
async function handleApproveUser(userId) {
  setApprovalLoading(userId)
  setMessage(null)
  try {
    await approveUser(userId, userProfile.uid)
  } catch (err) {
    console.error('approveUser failed:', err)
    setMessage({ type: 'error', text: 'Failed to approve user.' })
    setApprovalLoading(null)
    return
  }
  setMessage({ type: 'success', text: 'User approved.' })
  try {
    await loadData()
  } catch (err) {
    // keep the success message
  }
  setApprovalLoading(null)
}

async function handleRejectUser(userId) {
  const note = window.prompt('Optional rejection note') || ''
  setApprovalLoading(userId)
  setMessage(null)
  try {
    await rejectUser(userId, userProfile.uid, note)
  } catch (err) {
    console.error('rejectUser failed:', err)
    setMessage({ type: 'error', text: 'Failed to reject user.' })
    setApprovalLoading(null)
    return
  }
  setMessage({ type: 'success', text: 'User rejected.' })
  try {
    await loadData()
  } catch (err) {
    // keep the success message
  }
  setApprovalLoading(null)
}

function getMinistryName(id) {
  return ministries.find((m) => m.id === id)?.name || id
}
```

If `getMinistryName` already exists in the file, skip the duplicate definition — reuse the existing one.

- [ ] **Step 5: Render the Pending Approvals card in the Overview tab**

In the Overview tab JSX (where the existing stats cards and Top Volunteers live), insert a `message` banner near the top and the Pending Approvals card directly above the existing Top Volunteers or stat grid.

The banner (just inside the overview block):

```jsx
{message && <Notice type={message.type}>{message.text}</Notice>}
```

The Pending Approvals card:

```jsx
<div className="card">
  <div className="flex items-center justify-between mb-4">
    <h2 className="font-semibold text-lg">Pending Approvals</h2>
    <span className="badge bg-blue-100 text-blue-700">{pendingUsers.length} pending</span>
  </div>
  {pendingUsers.length === 0 ? (
    <p className="text-sm text-gray-500">No pending users need review.</p>
  ) : (
    <div className="space-y-3">
      {pendingUsers.map((u) => (
        <div key={u.id} className="flex flex-col gap-3 rounded-lg border border-gray-100 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium">{u.displayName || u.email}</p>
            <p className="text-sm text-gray-500">{u.email}</p>
            <p className="text-xs text-gray-400">
              Requested ministries: {(u.requestedMinistryIds || []).map(getMinistryName).join(', ') || 'None selected'}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              className="btn-primary text-sm"
              disabled={approvalLoading === u.id}
              onClick={() => handleApproveUser(u.id)}
            >
              {approvalLoading === u.id ? 'Approving...' : 'Approve'}
            </button>
            <button
              className="btn-secondary text-sm"
              disabled={approvalLoading === u.id}
              onClick={() => handleRejectUser(u.id)}
            >
              Reject
            </button>
          </div>
        </div>
      ))}
    </div>
  )}
</div>
```

- [ ] **Step 6: Build**

```powershell
npm.cmd run build
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/pages/AdminDashboard.jsx
git commit -m "AdminDashboard: add pending approvals card to overview tab"
```

---

### Task 14: AdminDashboard — Status column + filter in Users tab

**Files:**
- Modify: `src/pages/AdminDashboard.jsx`

- [ ] **Step 1: Add filter state**

Near the existing Users-tab state, add:

```jsx
const [userFilter, setUserFilter] = useState('all') // 'all' | 'pending' | 'approved' | 'rejected' | 'managed'
```

- [ ] **Step 2: Compute filtered list**

Inside the Users tab block (before the Users table is rendered), compute:

```jsx
const filteredUsers = users.filter((u) => {
  const status = u.approvalStatus || (u.role === 'admin' || u.role === 'ministry_leader' ? 'approved' : 'pending')
  if (userFilter === 'pending') return status === 'pending'
  if (userFilter === 'approved') return status === 'approved'
  if (userFilter === 'rejected') return status === 'rejected'
  if (userFilter === 'managed') return u.managed === true
  return true
})
```

- [ ] **Step 3: Render the filter select in the Users-tab heading**

Find the Users-tab heading row (currently the `Manage Users (N)` header). Replace it with a flex row containing the filter:

```jsx
<div className="flex flex-wrap items-center gap-2 mb-4">
  <h2 className="font-semibold text-lg">Manage Users ({filteredUsers.length})</h2>
  <select
    className="input text-sm"
    value={userFilter}
    onChange={(e) => setUserFilter(e.target.value)}
  >
    <option value="all">All</option>
    <option value="pending">Pending</option>
    <option value="approved">Approved</option>
    <option value="rejected">Rejected</option>
    <option value="managed">Managed volunteers</option>
  </select>
</div>
```

- [ ] **Step 4: Add a `Status` column to the Users table**

Find the `<th>` header row in the Users table. Add a new `<th>` for Status next to Role (or wherever visually sensible):

```jsx
<th className="text-left px-4 py-3">Status</th>
```

In the row body, add a new `<td>` next to the Role cell rendering the status badge:

```jsx
<td className="px-4 py-3">
  <span className="badge bg-gray-100 text-gray-700 capitalize">
    {u.approvalStatus || (u.role === 'admin' || u.role === 'ministry_leader' ? 'approved' : 'pending')}
  </span>
</td>
```

- [ ] **Step 5: Switch the map to use `filteredUsers`**

Replace `users.map(...)` inside the Users table body with `filteredUsers.map(...)`.

- [ ] **Step 6: Build**

```powershell
npm.cmd run build
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/pages/AdminDashboard.jsx
git commit -m "AdminDashboard: add status column and filter to Users tab"
```

---

### Task 15: LeaderDashboard — Pending Approvals section

**Files:**
- Modify: `src/pages/LeaderDashboard.jsx`

- [ ] **Step 1: Update imports**

Add to the existing `../services/firestore` import block:

```jsx
getPendingUsersForReviewer,
approveUser,
rejectUser,
```

Add a new import line:

```jsx
import Notice from '../components/Notice'
```

- [ ] **Step 2: Add state**

Near the other `useState` declarations, add:

```jsx
const [pendingUsers, setPendingUsers] = useState([])
const [approvalLoading, setApprovalLoading] = useState(null)
const [message, setMessage] = useState(null)
```

- [ ] **Step 3: Load pending users in the existing `loadData`**

Modify the `loadData` Promise.all to also fetch pending users scoped to this leader. If current code is:

```jsx
const [usersData, ministriesData, eventsData] = await Promise.all([ ... ])
```

Change to `Promise.allSettled` with the pending query appended. Read the existing `loadData` first and apply the same `pick` pattern as Task 13 Step 3; for LeaderDashboard the call is:

```jsx
getPendingUsersForReviewer(userProfile)
```

and after the results destructure:

```jsx
setPendingUsers(pick(pendingRes, [], 'pending users'))
```

- [ ] **Step 4: Add approval handlers**

Copy the same `handleApproveUser` / `handleRejectUser` handlers from Task 13 Step 4 into LeaderDashboard (ministry leaders use the same rules — Firestore rules enforce their scope; the UI doesn't need extra guards since `getPendingUsersForReviewer` already filters).

- [ ] **Step 5: Render the Pending Approvals section at the top of the returned JSX**

Add (inside the main return, near the top of the LeaderDashboard's content):

```jsx
{message && <Notice type={message.type}>{message.text}</Notice>}

<div className="card">
  <div className="flex items-center justify-between mb-4">
    <h2 className="font-semibold text-lg">Pending Approvals for my ministries</h2>
    <span className="badge bg-blue-100 text-blue-700">{pendingUsers.length} pending</span>
  </div>
  {pendingUsers.length === 0 ? (
    <p className="text-sm text-gray-500">No pending users in your ministries.</p>
  ) : (
    <div className="space-y-3">
      {pendingUsers.map((u) => (
        <div key={u.id} className="flex flex-col gap-3 rounded-lg border border-gray-100 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium">{u.displayName || u.email}</p>
            <p className="text-sm text-gray-500">{u.email}</p>
            <p className="text-xs text-gray-400">
              Requested ministries: {(u.requestedMinistryIds || []).map((id) => ministries.find((m) => m.id === id)?.name || id).join(', ') || 'None selected'}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              className="btn-primary text-sm"
              disabled={approvalLoading === u.id}
              onClick={() => handleApproveUser(u.id)}
            >
              {approvalLoading === u.id ? 'Approving...' : 'Approve'}
            </button>
            <button
              className="btn-secondary text-sm"
              disabled={approvalLoading === u.id}
              onClick={() => handleRejectUser(u.id)}
            >
              Reject
            </button>
          </div>
        </div>
      ))}
    </div>
  )}
</div>
```

- [ ] **Step 6: Build**

```powershell
npm.cmd run build
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/pages/LeaderDashboard.jsx
git commit -m "LeaderDashboard: add scoped pending approvals section"
```

---

### Task 16: Firestore rules — approval enforcement

**Files:**
- Modify: `firestore.rules`

This task ONLY updates the file. Deploying the rules to production happens in Task 17 after the migration.

- [ ] **Step 1: Replace the file content**

Replace `firestore.rules` entirely with:

```js
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    function isAuth() {
      return request.auth != null;
    }

    function currentUser() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data;
    }

    function isApproved() {
      return isAuth()
        && (
          currentUser().approvalStatus == 'approved'
          || (!currentUser().keys().hasAny(['approvalStatus'])
            && currentUser().role in ['admin', 'ministry_leader'])
        );
    }

    function isSelf(userId) {
      return isAuth() && request.auth.uid == userId;
    }

    function roleUnchanged() {
      return !request.resource.data.diff(resource.data).affectedKeys().hasAny(['role']);
    }

    function approvalFieldsOnlyChanged() {
      return request.resource.data.diff(resource.data).affectedKeys()
        .hasOnly(['approvalStatus', 'approvedBy', 'approvedAt', 'approvalNote', 'updatedAt']);
    }

    function approvalUpdateIsValid() {
      return request.resource.data.approvalStatus in ['approved', 'rejected']
        && request.resource.data.approvedBy == request.auth.uid;
    }

    function requestedMinistryOverlap() {
      return resource.data.requestedMinistryIds is list
        && currentUser().ministries is list
        && currentUser().ministries.hasAny(resource.data.requestedMinistryIds);
    }

    function isAdmin() {
      return isAuth() && currentUser().role == 'admin';
    }

    function isLeaderOrAdmin() {
      return isAuth() && currentUser().role in ['admin', 'ministry_leader'];
    }

    match /users/{userId} {
      allow read: if isAuth();
      allow create: if isSelf(userId)
        && request.resource.data.role == 'volunteer'
        && request.resource.data.approvalStatus == 'pending';
      allow create: if isAdmin()
        && request.resource.data.managed == true
        && request.resource.data.role == 'volunteer'
        && request.resource.data.approvalStatus == 'approved';
      allow update: if isSelf(userId)
        && roleUnchanged()
        && !request.resource.data.diff(resource.data).affectedKeys()
          .hasAny(['approvalStatus', 'approvedBy', 'approvedAt', 'approvalNote']);
      allow update: if isAdmin();
      allow update: if isLeaderOrAdmin()
        && !isSelf(userId)
        && currentUser().role == 'ministry_leader'
        && approvalFieldsOnlyChanged()
        && approvalUpdateIsValid()
        && requestedMinistryOverlap();
      allow delete: if isAdmin();
    }

    match /ministries/{ministryId} {
      allow read: if isAuth();
      allow create, update, delete: if isLeaderOrAdmin();
    }

    match /events/{eventId} {
      allow read: if isAuth();
      allow create, update, delete: if isLeaderOrAdmin();
    }

    match /eventSignups/{signupId} {
      allow read: if isAuth();
      allow create: if isApproved();
      allow update: if isAuth() && (
        resource.data.userId == request.auth.uid || isLeaderOrAdmin()
      );
      allow delete: if isAuth() && (
        resource.data.userId == request.auth.uid || isLeaderOrAdmin()
      );
    }

    match /attendanceLogs/{logId} {
      allow read: if isAuth();
      allow create: if isAuth();
      allow update, delete: if isLeaderOrAdmin();
    }

    match /serviceHours/{hourId} {
      allow read: if isAuth();
      allow create: if isAuth();
      allow update, delete: if isAdmin();
    }
  }
}
```

- [ ] **Step 2: Verify the file compiles**

If the Firebase CLI is installed and authenticated for this project, run:

```powershell
firebase deploy --only firestore:rules --dry-run
```

Expected: "rules file firestore.rules compiled successfully". If the CLI is not installed, skip — the deploy in Task 17 will surface any compile error.

- [ ] **Step 3: Commit**

```bash
git add firestore.rules
git commit -m "Enforce approval gating in Firestore rules"
```

---

### Task 17: Migration script + final verification

**Files:**
- Create: `scripts/backfill-approval-status.mjs`
- Create: `docs/approval-gated-rollout.md`

- [ ] **Step 1: Create the migration script**

```js
// scripts/backfill-approval-status.mjs
//
// One-time migration: write approvalStatus on every /users doc that lacks it.
// - admin / ministry_leader roles -> 'approved'
// - any other role -> 'pending'
//
// Usage:
//   1. Generate a service account key in Firebase Console (Project settings > Service accounts > Generate new private key).
//   2. Save the JSON content to an env var, e.g.:
//      $env:SERVICE_ACCOUNT_KEY = Get-Content serviceAccountKey.json -Raw
//   3. Run: node scripts/backfill-approval-status.mjs
//
// The script is idempotent — re-running skips docs that already have approvalStatus.

import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'

if (!process.env.SERVICE_ACCOUNT_KEY) {
  console.error('SERVICE_ACCOUNT_KEY env var is required.')
  process.exit(1)
}

initializeApp({ credential: cert(JSON.parse(process.env.SERVICE_ACCOUNT_KEY)) })
const db = getFirestore()

async function main() {
  const snap = await db.collection('users').get()
  console.log(`Scanning ${snap.size} users...`)

  let updated = 0
  let skipped = 0
  const batchSize = 400
  let batch = db.batch()
  let opsInBatch = 0

  for (const docSnap of snap.docs) {
    const data = docSnap.data()
    if (data.approvalStatus) {
      skipped++
      continue
    }
    const status = (data.role === 'admin' || data.role === 'ministry_leader')
      ? 'approved'
      : 'pending'
    batch.update(docSnap.ref, {
      approvalStatus: status,
      approvedBy: data.approvedBy ?? null,
      approvedAt: data.approvedAt ?? null,
      approvalNote: data.approvalNote ?? '',
      requestedMinistryIds: Array.isArray(data.requestedMinistryIds) ? data.requestedMinistryIds : [],
      updatedAt: Timestamp.now(),
    })
    updated++
    opsInBatch++
    if (opsInBatch >= batchSize) {
      await batch.commit()
      batch = db.batch()
      opsInBatch = 0
    }
  }

  if (opsInBatch > 0) await batch.commit()
  console.log(`Updated: ${updated}. Skipped (already had approvalStatus): ${skipped}.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
```

- [ ] **Step 2: Add a dev dependency for firebase-admin**

```powershell
npm.cmd install --save-dev firebase-admin
```

Expected: `firebase-admin` appears in `package.json` `devDependencies`.

- [ ] **Step 3: Create the rollout checklist doc**

```markdown
# Approval-Gated Rollout Checklist

Run these steps in order after merging `feature/approval-gated` into `main`.

## 1. Client code deploy (Vercel)

Merging to `main` triggers a Vercel production deploy automatically. Verify on the Vercel dashboard that the new deployment reaches "Ready" state.

Smoke test on a preview URL BEFORE promoting to production if possible:
- Register a test user -> lands on `/pending-approval`.
- Admin test account sees the test user in the Overview -> Pending Approvals card.
- Approve via admin button -> test user's status flips to approved, event signup unlocks.

## 2. Migration

On your local machine, from the repo root:

```powershell
# Obtain a service-account key from Firebase Console.
$env:SERVICE_ACCOUNT_KEY = Get-Content serviceAccountKey.json -Raw
node scripts/backfill-approval-status.mjs
```

Expected output: `Updated: N. Skipped: M.` where N is the number of pre-existing users that got backfilled.

Spot-check 3-5 user docs in the Firestore console:
- Your admin doc has `approvalStatus: 'approved'`.
- A non-admin volunteer doc has `approvalStatus: 'pending'`.
- Any managed-volunteer docs created by the new code have `approvalStatus: 'approved'`.

## 3. Firestore rules deploy

```powershell
firebase deploy --only firestore:rules
```

Expected: `rules file firestore.rules compiled successfully` and `released rules firestore.rules to cloud.firestore`.

## 4. Post-deploy verification (production site)

- [ ] Register a fresh test user on `volunteerattherock.com`. Confirm it lands on `/pending-approval`.
- [ ] Open DevTools -> Console. No red errors.
- [ ] Events page renders with disabled "Approval required" button for the pending user.
- [ ] Admin dashboard shows the pending user; approving flips their access.
- [ ] A ministry-leader account with at least one ministry in their `ministries` array can see and approve users whose `requestedMinistryIds` overlap that ministry, and CANNOT see users outside their scope.
- [ ] Existing approved users continue to function normally (login, dashboard, signups).
- [ ] Managed-volunteer creation still works; created docs have `approvalStatus: 'approved'`.

## Rollback (if needed)

- Revert the merge commit on `main` and redeploy the previous Vercel build.
- Redeploy the previous Firestore rules (stored in git history before this branch). Example: `git checkout <pre-merge-sha> -- firestore.rules && firebase deploy --only firestore:rules`.
- The migration is additive-only — no rollback needed for the Firestore data. New `approvalStatus` fields become dormant when the old client code is restored.
```

Save to `docs/approval-gated-rollout.md`.

- [ ] **Step 4: Final build**

```powershell
npm.cmd run build
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/backfill-approval-status.mjs package.json package-lock.json docs/approval-gated-rollout.md
git commit -m "Add backfill-approval-status migration script and rollout doc"
```

- [ ] **Step 6: Final diff summary**

Run:

```powershell
git log --oneline <baseline-SHA>..HEAD
git diff --stat <baseline-SHA>..HEAD
```

Expected: ~16 commits, ~10-12 files touched. Record this for the merge PR description.
