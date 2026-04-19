# Wave 1 — Field-Test Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the six field-test gaps from the 2026-04-19 live run of the Church Volunteer App: save-feedback across admin mutations, multi-session check-in/out, strangers-as-walk-ins, Check-In volunteer search, ministry-dropdown refresh, and (pre-verified) managed-volunteer email/phone.

**Architecture:** All Wave 1 changes are client-side + one Firestore doc-shape addition (`sessions[]` on `eventSignups`) + one local one-shot backfill. No new auth or rules work. Two new React contexts (Toast, Ministries) + one custom hook (`useAsyncAction`) form the cross-cutting primitives. UI changes land on `AdminDashboard` (all tabs touch the new primitives; Check-In tab gets most of the surface work). `LeaderDashboard` only consumes the new `useMinistries` hook and wraps any mutations that exist when the Wave 1 branch rebases on top of the shipped approval-gated work.

**Tech Stack:** React 18 · Vite 5 · Firebase 10 (Firestore) · react-router-dom 6 · Tailwind 3 · lucide-react · Firebase Admin SDK for the backfill script.

**Spec:** `docs/superpowers/specs/2026-04-19-wave1-field-test-fixes-design.md`

**Testing convention:** This repo has no automated test framework by policy. Each task's verification step is a manual browser check against `npm run dev` (local Firebase) or the Vercel preview URL. Treat verification as a hard gate — do not commit a task until its verification passes. Document the observed behavior in the commit message when it's non-obvious.

---

## Pre-Flight

### Task 0: Branch setup & environment sanity

**Files:** none created, repo state only.

- [ ] **Step 1: Confirm the approval-gated work is on main**

Run: `cd C:/Users/HansE/Configurator-Field && git log --oneline main -10`
Expected: the top should include either the implementation commits for `2026-04-17-approval-gated-main-design.md` OR the spec/plan commits only. If only spec/plan commits are present, note this — Task 13 behavior changes accordingly.

- [ ] **Step 2: Create the Wave 1 feature branch off main**

Run: `git checkout -b wave1-field-test-fixes`
Expected: `Switched to a new branch 'wave1-field-test-fixes'`.

- [ ] **Step 3: Install deps, smoke-start the dev server**

Run: `npm install && npm run dev`
Expected: Vite starts on `http://localhost:5173/`. Load the app, log in as the admin user, see the Admin Dashboard render with existing data.

Leave the dev server running in one terminal for the rest of the plan.

- [ ] **Step 4: Verify Firestore access**

In the admin dashboard on localhost, create and delete a throwaway ministry called `_wave1_smoke`. Expected: appears then disappears. Confirms your local env vars (`.env` / `.env.local`) point to a Firebase project you can write to.

**Important:** This project has a single Firebase project (no dev/prod split — see `src/firebase.js`). All manual smoke testing writes to real Firestore. Use an `_wave1_` prefix on any throwaway records and delete them when done. Do not run smoke tests during a live event window.

---

## Primitives

### Task 1: Toast context

**Files:**
- Create: `src/contexts/ToastContext.jsx`
- Create: `src/components/Toast.jsx`

- [ ] **Step 1: Write `ToastContext.jsx`**

```jsx
// src/contexts/ToastContext.jsx
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'

const ToastContext = createContext(null)

let nextId = 1

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timers = useRef(new Map())

  const dismiss = useCallback((id) => {
    setToasts((ts) => ts.filter((t) => t.id !== id))
    const timer = timers.current.get(id)
    if (timer) { clearTimeout(timer); timers.current.delete(id) }
  }, [])

  const push = useCallback((type, message, { sticky = false } = {}) => {
    const id = nextId++
    setToasts((ts) => [...ts.slice(-2), { id, type, message, sticky }])
    if (!sticky) {
      const timer = setTimeout(() => dismiss(id), 3000)
      timers.current.set(id, timer)
    }
    return id
  }, [dismiss])

  const api = useMemo(() => ({
    success: (msg) => push('success', msg),
    info: (msg) => push('info', msg),
    error: (msg) => push('error', msg, { sticky: true }),
    dismiss,
  }), [push, dismiss])

  return <ToastContext.Provider value={{ toasts, api }}>{children}</ToastContext.Provider>
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx.api
}

export function useToastState() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToastState must be used inside <ToastProvider>')
  return ctx
}
```

- [ ] **Step 2: Write `Toast.jsx`**

```jsx
// src/components/Toast.jsx
import { CheckCircle2, Info, XCircle, X } from 'lucide-react'
import { useToastState } from '../contexts/ToastContext'

const styles = {
  success: 'bg-green-50 border-green-200 text-green-800',
  info:    'bg-blue-50 border-blue-200 text-blue-800',
  error:   'bg-red-50 border-red-200 text-red-800',
}

const icons = {
  success: CheckCircle2,
  info:    Info,
  error:   XCircle,
}

export default function ToastContainer() {
  const { toasts, api } = useToastState()
  if (toasts.length === 0) return null
  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2 w-80 max-w-[calc(100vw-2rem)]">
      {toasts.map((t) => {
        const Icon = icons[t.type]
        return (
          <div key={t.id} role="status" className={`flex items-start gap-2 border rounded-lg px-3 py-2 shadow-sm text-sm ${styles[t.type]}`}>
            <Icon size={16} className="mt-0.5 shrink-0" />
            <span className="flex-1 break-words">{t.message}</span>
            <button onClick={() => api.dismiss(t.id)} className="opacity-60 hover:opacity-100 shrink-0" aria-label="Dismiss"><X size={14} /></button>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 3: Verify files parse**

Reload the dev server tab. Expected: no red Vite overlay, no console errors. (The package's `lint` script is `eslint .` but the repo doesn't ship an ESLint config for React JSX by default; HMR + a clean console is the reliable check.)

- [ ] **Step 4: Commit**

```bash
git add src/contexts/ToastContext.jsx src/components/Toast.jsx
git commit -m "feat: toast context and component"
```

---

### Task 2: `useAsyncAction` hook

**Files:**
- Create: `src/hooks/useAsyncAction.js`

- [ ] **Step 1: Write the hook**

```js
// src/hooks/useAsyncAction.js
import { useCallback, useState } from 'react'
import { useToast } from '../contexts/ToastContext'

// run(actionFn, { successMessage, errorMessage }) -> Promise<result>
// Provides: saving boolean, last error.
// Handles: spinner state, success toast, error toast with server error message.
export function useAsyncAction() {
  const toast = useToast()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const run = useCallback(async (fn, { successMessage = 'Saved', errorMessage = 'Could not save' } = {}) => {
    setSaving(true); setError(null)
    try {
      const result = await fn()
      if (successMessage) toast.success(successMessage)
      return result
    } catch (err) {
      setError(err)
      toast.error(`${errorMessage}: ${err?.message || String(err)}`)
      throw err
    } finally {
      setSaving(false)
    }
  }, [toast])

  return { run, saving, error }
}
```

- [ ] **Step 2: Verify**

Run: `npm run dev` (if not still running). Confirm HMR reloads without console errors. The hook won't be exercised yet — just confirming it parses and the import path is valid.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useAsyncAction.js
git commit -m "feat: useAsyncAction hook for async handlers with toast feedback"
```

---

### Task 3: `useMinistries` shared cache

**Files:**
- Create: `src/contexts/MinistriesContext.jsx`

- [ ] **Step 1: Write the context + hook**

```jsx
// src/contexts/MinistriesContext.jsx
import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { getMinistries } from '../services/firestore'

const MinistriesContext = createContext(null)

export function MinistriesProvider({ children }) {
  const [ministries, setMinistries] = useState([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getMinistries()
      setMinistries(data)
    } catch (err) {
      console.error('useMinistries refresh failed:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  return (
    <MinistriesContext.Provider value={{ ministries, loading, refresh }}>
      {children}
    </MinistriesContext.Provider>
  )
}

export function useMinistries() {
  const ctx = useContext(MinistriesContext)
  if (!ctx) throw new Error('useMinistries must be used inside <MinistriesProvider>')
  return ctx
}
```

- [ ] **Step 2: Verify**

Run: dev server picks up HMR with no errors. Hook is not consumed yet.

- [ ] **Step 3: Commit**

```bash
git add src/contexts/MinistriesContext.jsx
git commit -m "feat: useMinistries shared cache hook"
```

---

### Task 4: Wire providers + render toast container

**Files:**
- Modify: `src/main.jsx`
- Modify: `src/components/Layout.jsx`

- [ ] **Step 1: Wrap providers in `main.jsx`**

Replace the existing render call with:

```jsx
// src/main.jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './contexts/AuthContext'
import { ToastProvider } from './contexts/ToastContext'
import { MinistriesProvider } from './contexts/MinistriesContext'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <MinistriesProvider>
            <App />
          </MinistriesProvider>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
```

Provider nesting order: Auth (top) → Toast → Ministries. Ministries calls `getMinistries()` which needs Firestore auth to be initialized, so it must sit inside AuthProvider. Toast has no dependencies; placing it between keeps it available everywhere but detaches it from Ministries.

- [ ] **Step 2: Render ToastContainer in `Layout.jsx`**

```jsx
// src/components/Layout.jsx
import { Outlet } from 'react-router-dom'
import Navbar from './Navbar'
import ToastContainer from './Toast'

export default function Layout() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
      <ToastContainer />
    </div>
  )
}
```

- [ ] **Step 3: Manual verification**

Open the app on localhost. Load `/dashboard`, `/admin`, `/leaders`. Expected: every protected route still renders; no new console errors; no visible toast yet (the container only renders when toasts exist).

Open the React devtools and confirm three providers are nested around `<App />`: `AuthProvider → ToastProvider → MinistriesProvider`.

- [ ] **Step 4: Smoke the toast from devtools (temporary)**

In `Layout.jsx`, temporarily add this above the return:

```jsx
import { useToast } from '../contexts/ToastContext'
// …inside Layout():
const toast = useToast()
window.__toast = toast // dev-only hook
```

Reload, open console, run `__toast.success('hello')`, `__toast.error('sad')`. Expected: green toast auto-dismisses at 3s; red toast is sticky until you press its X.

Remove the temporary `window.__toast = toast` and `import`/`const` lines before committing.

- [ ] **Step 5: Commit**

```bash
git add src/main.jsx src/components/Layout.jsx
git commit -m "feat: wire Toast and Ministries providers; render ToastContainer"
```

---

## Data Layer

### Task 5: Add session primitives to `firestore.js`

**Files:**
- Modify: `src/services/firestore.js` (appends to the existing file; keeps all existing exports intact)

- [ ] **Step 1: Add `getOpenSession` helper (pure)**

Append after the "--- Check-in / Check-out ---" block (around line 87), as the new canonical helpers:

```js
// --- Sessions (multi-session check-in/out) ---

// Pure helper. Returns the last session if it has no checkOutAt, else null.
// Tolerates legacy signups that have checkedInAt but no sessions[] by
// synthesizing a single-element view. The backfill script makes this branch
// unnecessary after rollout, but the fallback keeps pre-backfill clients safe.
export function getOpenSession(signup) {
  const sessions = Array.isArray(signup?.sessions) ? signup.sessions : null
  if (sessions && sessions.length > 0) {
    const last = sessions[sessions.length - 1]
    return last.checkOutAt ? null : last
  }
  // Legacy fallback
  if (signup?.checkedInAt && !signup?.checkedOutAt) {
    return { checkInAt: signup.checkedInAt, checkOutAt: null, hoursLogged: 0, department: signup.department || null }
  }
  return null
}

// Returns the effective session list for a signup, synthesizing one from
// legacy fields when `sessions` is missing. Read-only — does not mutate.
export function getSessions(signup) {
  if (Array.isArray(signup?.sessions)) return signup.sessions
  if (signup?.checkedInAt) {
    return [{
      checkInAt: signup.checkedInAt,
      checkOutAt: signup.checkedOutAt || null,
      hoursLogged: signup.hoursLogged || 0,
      department: signup.department || null,
    }]
  }
  return []
}
```

- [ ] **Step 2: Add `startSession`**

Append directly below:

```js
// Opens a new session on a signup. Fails loudly if one is already open.
// Writes sessions[] (append), status='checked_in', checkedInAt (first session only).
export async function startSession(signupId, department = null) {
  const ref = doc(db, 'eventSignups', signupId)
  const snap = await getDoc(ref)
  if (!snap.exists()) throw new Error('Signup not found')
  const data = snap.data()

  const existingOpen = getOpenSession({ ...data, id: snap.id })
  if (existingOpen) throw new Error('A session is already open for this volunteer')

  const existingSessions = Array.isArray(data.sessions) ? data.sessions : []
  const now = Timestamp.now()
  const newSession = { checkInAt: now, checkOutAt: null, hoursLogged: 0, department: department || null }

  const patch = {
    sessions: [...existingSessions, newSession],
    status: 'checked_in',
    checkedOutAt: null,
    department: department || null,
  }
  // Keep parent checkedInAt aligned with first session for legacy readers.
  if (existingSessions.length === 0) patch.checkedInAt = now

  await updateDoc(ref, patch)
}
```

- [ ] **Step 3: Add `endSession`**

Append directly below:

```js
// Closes the currently open session. manualHours overrides the clock math
// when supplied. Writes one /attendanceLogs row and one /serviceHours row,
// increments /users/{userId}.totalHours + totalPoints + lastServedDate.
// Matches today's checkOut side-effects, scoped to the closing session.
export async function endSession(signupId, userId, { manualHours = null } = {}) {
  const ref = doc(db, 'eventSignups', signupId)
  const snap = await getDoc(ref)
  if (!snap.exists()) throw new Error('Signup not found')
  const data = snap.data()

  const sessions = Array.isArray(data.sessions) ? [...data.sessions] : []
  const idx = sessions.length - 1
  const open = idx >= 0 ? sessions[idx] : null
  if (!open || open.checkOutAt) throw new Error('No open session to close')

  const now = Timestamp.now()
  let hoursLogged
  if (manualHours !== null && Number(manualHours) >= 0) {
    hoursLogged = Number(manualHours)
  } else {
    const checkedInAt = open.checkInAt?.toDate?.() || open.checkInAt
    const start = checkedInAt instanceof Date ? checkedInAt : new Date(checkedInAt)
    hoursLogged = Math.round(((now.toDate() - start) / (1000 * 60 * 60)) * 100) / 100
  }

  const closed = { ...open, checkOutAt: now, hoursLogged }
  sessions[idx] = closed
  const totalHours = sessions.reduce((sum, s) => sum + (s.hoursLogged || 0), 0)

  await updateDoc(ref, {
    sessions,
    hoursLogged: totalHours,
    status: 'checked_out',
    checkedOutAt: now,
  })

  await addDoc(collection(db, 'attendanceLogs'), {
    userId, signupId, eventId: data.eventId,
    checkedInAt: open.checkInAt, checkedOutAt: now,
    hoursLogged, department: closed.department || null,
    createdAt: serverTimestamp(),
  })

  const pointsEarned = Math.floor(hoursLogged * 10)
  if (userId) {
    await updateDoc(doc(db, 'users', userId), {
      totalHours: increment(hoursLogged),
      totalPoints: increment(pointsEarned),
      lastServedDate: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    await addDoc(collection(db, 'serviceHours'), {
      userId, eventId: data.eventId, hours: hoursLogged, points: pointsEarned,
      department: closed.department || null, date: serverTimestamp(),
    })
  }

  return { hoursLogged, pointsEarned }
}
```

- [ ] **Step 4: Verify imports**

The existing file already imports `doc`, `getDoc`, `updateDoc`, `addDoc`, `collection`, `Timestamp`, `serverTimestamp`, `increment`, and `db` — no new imports needed. Confirm by scanning lines 1–5 of `firestore.js`.

- [ ] **Step 5: Manual verification via devtools**

In the running dev app's console:

```js
const { startSession, endSession, getOpenSession } = await import('/src/services/firestore.js')
// Pick an existing signup id from Firestore console or Check-In tab:
const id = '<SIGNUP_ID>'
await startSession(id)
// Verify in Firebase console: the eventSignups doc now has sessions = [{…}] with checkOutAt: null, status 'checked_in'.
await endSession(id, '<USER_ID>', { manualHours: 0.25 })
// Verify: sessions[0].checkOutAt is set, hoursLogged=0.25, status 'checked_out'.
await startSession(id)
// Verify: sessions now length 2, last one open.
await endSession(id, '<USER_ID>')  // clock-based
// Verify: sessions length 2 both closed, parent hoursLogged = 0.25 + clock-derived second.
```

Clean up afterwards: delete the throwaway signup or use a test event.

- [ ] **Step 6: Commit**

```bash
git add src/services/firestore.js
git commit -m "feat: startSession/endSession/getOpenSession/getSessions for multi-session attendance"
```

---

### Task 6: Refactor existing mutations to write sessions

**Files:**
- Modify: `src/services/firestore.js` (edit existing `checkIn`, `checkOut`, `adminAddVolunteer`, `signUpForEvent`, `assignDepartment`)

- [ ] **Step 1: Make `checkIn` delegate to `startSession`**

Replace the existing `checkIn` (currently around line 89–91):

```js
export async function checkIn(signupId) {
  return startSession(signupId)
}
```

- [ ] **Step 2: Make `checkOut` delegate to `endSession`**

Replace the existing `checkOut` (currently around line 93–127):

```js
export async function checkOut(signupId, userId, manualHours = null) {
  return endSession(signupId, userId, { manualHours })
}
```

- [ ] **Step 3: Update `adminAddVolunteer` to seed a session**

Replace the existing `adminAddVolunteer` (currently around line 129–141):

```js
export async function adminAddVolunteer(eventId, userId, userName) {
  const existing = query(collection(db, 'eventSignups'), where('eventId', '==', eventId), where('userId', '==', userId))
  const snapshot = await getDocs(existing)
  if (!snapshot.empty) throw new Error('Already added')

  const now = Timestamp.now()
  const ref = await addDoc(collection(db, 'eventSignups'), {
    eventId, userId, userName,
    status: 'checked_in',
    checkedInAt: now,
    checkedOutAt: null,
    hoursLogged: 0,
    department: null,
    sessions: [{ checkInAt: now, checkOutAt: null, hoursLogged: 0, department: null }],
    createdAt: serverTimestamp(),
  })
  await updateDoc(doc(db, 'events', eventId), { signupCount: increment(1) })
  return ref
}
```

- [ ] **Step 4: Update `signUpForEvent` to seed empty sessions**

In the existing `signUpForEvent` (around line 58–68), add `sessions: []` to the `addDoc` payload:

```js
await addDoc(collection(db, 'eventSignups'), {
  eventId, userId, userName, status: 'signed_up',
  checkedInAt: null, checkedOutAt: null, hoursLogged: 0, department: null,
  sessions: [],
  createdAt: serverTimestamp(),
})
```

- [ ] **Step 5: Update `assignDepartment` to patch the open session too**

Replace the existing `assignDepartment` (currently around line 154–156):

```js
export async function assignDepartment(signupId, department) {
  const ref = doc(db, 'eventSignups', signupId)
  const snap = await getDoc(ref)
  if (!snap.exists()) return
  const data = snap.data()
  const sessions = Array.isArray(data.sessions) ? [...data.sessions] : []
  const idx = sessions.length - 1
  if (idx >= 0 && !sessions[idx].checkOutAt) {
    sessions[idx] = { ...sessions[idx], department: department || null }
    return updateDoc(ref, { sessions, department: department || null })
  }
  return updateDoc(ref, { department: department || null })
}
```

- [ ] **Step 6: Manual verification**

On the Check-In tab, pick a pre-existing event with at least one signed-up volunteer. Run end-to-end: Check In → observe Firestore console: `sessions` is a one-element array with `checkOutAt: null`; `status === 'checked_in'`. Check Out → `sessions[0].checkOutAt` set, `status === 'checked_out'`, `attendanceLogs` and `serviceHours` each gained one row, user `totalHours` incremented. Click Check In again → second session opens. Check Out with manual hours → second session records exactly that value.

- [ ] **Step 7: Commit**

```bash
git add src/services/firestore.js
git commit -m "refactor: existing signup/check-in paths write sessions array"
```

---

### Task 7: Add `createWalkInVolunteer`

**Files:**
- Modify: `src/services/firestore.js` (append)

- [ ] **Step 1: Add the helper**

Append after the `createManagedVolunteer` block:

```js
// One-shot "new person just walked in" flow:
// 1) create managed volunteer (no Auth account), 2) open a session on the event.
// Returns { userId, signupId }. Name is required.
export async function createWalkInVolunteer(eventId, { displayName, email = '', phone = '' }) {
  if (!displayName || !displayName.trim()) throw new Error('Name is required')
  const userRef = await createManagedVolunteer({ displayName: displayName.trim(), email, phone })
  const signupRef = await adminAddVolunteer(eventId, userRef.id, displayName.trim())
  return { userId: userRef.id, signupId: signupRef.id }
}
```

- [ ] **Step 2: Manual verification via devtools**

```js
const { createWalkInVolunteer } = await import('/src/services/firestore.js')
await createWalkInVolunteer('<EVENT_ID>', { displayName: '_wave1_walkin', email: '_wave1@example.com' })
// In Firebase console:
// - /users gains a new doc: managed=true, email set, role='volunteer'.
// - /eventSignups gains a doc with sessions=[{…}] open, userName='_wave1_walkin'.
```

Delete the two docs when verified.

- [ ] **Step 3: Commit**

```bash
git add src/services/firestore.js
git commit -m "feat: createWalkInVolunteer (managed volunteer + first session in one call)"
```

---

## Admin Check-In UI

All following tasks edit `src/pages/AdminDashboard.jsx`. Steps show the specific replacements in context.

### Task 8: Volunteer search on the signups list

**Files:**
- Modify: `src/pages/AdminDashboard.jsx`

- [ ] **Step 1: Add search state**

Near the other check-in state declarations (around line 41–47), add:

```jsx
const [signupSearch, setSignupSearch] = useState('')
```

Reset it inside `openCheckIn` alongside the other resets (around line 91):

```jsx
setSignupSearch('')
```

- [ ] **Step 2: Add a filter helper above the component's return**

Near `getMinistryName` / `getDeptInfo` (around line 133):

```jsx
function matchesSearch(candidate, query) {
  if (!query || query.length < 2) return true
  const q = query.toLowerCase()
  const name = (candidate.userName || candidate.displayName || '').toLowerCase()
  const email = (candidate.email || '').toLowerCase()
  return name.includes(q) || email.includes(q)
}
```

`eventSignups` rows don't carry the user's email; pair them with the already-loaded `users` array when filtering:

```jsx
function signupMatches(signup) {
  if (!signupSearch || signupSearch.length < 2) return true
  const user = users.find((u) => u.id === signup.userId)
  return matchesSearch({ ...signup, email: user?.email }, signupSearch)
}
```

- [ ] **Step 3: Render the search box above the signups list**

Inside the `{tab === 'checkin' && …}` block, after the attendance summary header (around line 413) and before the signups list conditional, insert:

```jsx
{eventSignups.length > 0 && (
  <div className="relative mb-3">
    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
    <input
      type="text"
      className="input pl-9 text-sm"
      placeholder="Search signed-up volunteers by name or email…"
      value={signupSearch}
      onChange={(e) => setSignupSearch(e.target.value)}
    />
  </div>
)}
```

- [ ] **Step 4: Apply the filter to the map**

Replace the existing `eventSignups.sort(…).map(…)` call (around line 442) with:

```jsx
{eventSignups.filter(signupMatches).sort((a, b) => { const order = { checked_in: 0, signed_up: 1, checked_out: 2, released: 3, no_show: 4 }; return (order[a.status] || 5) - (order[b.status] || 5) }).map((signup) => (
```

- [ ] **Step 5: Manual verification**

Open an event with multiple signups. Type a partial name → list narrows. Type a partial email (e.g., `@gmail`) → list narrows by email. Clear the input → full list returns. Fewer than 2 chars → no filtering.

- [ ] **Step 6: Commit**

```bash
git add src/pages/AdminDashboard.jsx
git commit -m "feat(admin): volunteer search on Check-In signups list"
```

---

### Task 9: "New walk-in" modal (strangers flow)

**Files:**
- Modify: `src/pages/AdminDashboard.jsx`

- [ ] **Step 1: Add import for the new service**

Update the `firestore` import block (line 3–10):

```jsx
import {
  getAllUsers, getEvents, getMinistries, getServiceHoursSummary,
  createEvent, createMinistry, updateEvent, deleteEvent,
  updateMinistry, deleteMinistry, updateUserRole, getEventSignups,
  signUpForEvent, cancelSignup,
  checkIn, checkOut, adminAddVolunteer, releaseVolunteer, markNoShow,
  createManagedVolunteer, deleteVolunteer, assignDepartment, updateVolunteerProfile,
  createWalkInVolunteer, getOpenSession,
} from '../services/firestore'
```

- [ ] **Step 2: Add state for the new walk-in modal**

Near the other check-in state (around line 41–47):

```jsx
const [showNewWalkIn, setShowNewWalkIn] = useState(false)
const [newWalkInForm, setNewWalkInForm] = useState({ displayName: '', email: '', phone: '' })
```

- [ ] **Step 3: Add a handler**

Near `handleAddWalkIn` (around line 127):

```jsx
async function handleCreateNewWalkIn(e) {
  e.preventDefault()
  if (!newWalkInForm.displayName.trim()) { alert('Name is required'); return }
  try {
    await createWalkInVolunteer(checkInEventId, newWalkInForm)
    setNewWalkInForm({ displayName: '', email: '', phone: '' })
    setShowNewWalkIn(false)
    await refreshSignups()
    await loadData()
  } catch (err) {
    alert(err.message || 'Failed to add walk-in')
  }
}
```

(Task 11 will migrate this and other handlers to `useAsyncAction` + toast. Keeping `alert` for this task so the feature is usable in isolation and the diff for Task 11 stays focused.)

- [ ] **Step 4: Add the button next to "Add Walk-In"**

In the header button group of the Check-In tab (around line 405), replace the single walk-in button with:

```jsx
<button onClick={() => { setShowAddVolunteer(!showAddVolunteer); setShowNewWalkIn(false) }} className="btn-secondary text-xs py-1.5 px-3 flex items-center space-x-1"><UserPlus size={12} /><span>Add Walk-In</span></button>
<button onClick={() => { setShowNewWalkIn(!showNewWalkIn); setShowAddVolunteer(false) }} className="btn-secondary text-xs py-1.5 px-3 flex items-center space-x-1"><UserPlus size={12} /><span>New Walk-In</span></button>
```

- [ ] **Step 5: Render the modal form**

Directly after the existing `{showAddVolunteer && …}` block (around line 436), insert:

```jsx
{showNewWalkIn && (
  <form onSubmit={handleCreateNewWalkIn} className="mb-4 p-3 bg-indigo-50 border border-indigo-200 rounded-lg space-y-3">
    <p className="text-sm font-medium text-indigo-800">New walk-in (person not in the system yet)</p>
    <div className="grid sm:grid-cols-3 gap-3">
      <div><label className="label">Name *</label><input className="input" required value={newWalkInForm.displayName} onChange={(e) => setNewWalkInForm({ ...newWalkInForm, displayName: e.target.value })} placeholder="Jane Smith" /></div>
      <div><label className="label">Email (optional)</label><input type="email" className="input" value={newWalkInForm.email} onChange={(e) => setNewWalkInForm({ ...newWalkInForm, email: e.target.value })} placeholder="jane@email.com" /></div>
      <div><label className="label">Phone (optional)</label><input type="tel" className="input" value={newWalkInForm.phone} onChange={(e) => setNewWalkInForm({ ...newWalkInForm, phone: e.target.value })} placeholder="(555) 123-4567" /></div>
    </div>
    <div className="flex space-x-2">
      <button type="submit" className="btn-primary text-xs py-1.5 px-3">Create & Check In</button>
      <button type="button" onClick={() => { setShowNewWalkIn(false); setNewWalkInForm({ displayName: '', email: '', phone: '' }) }} className="btn-secondary text-xs py-1.5 px-3">Cancel</button>
    </div>
  </form>
)}
```

- [ ] **Step 6: Manual verification**

Pick an event. Click **New Walk-In**. Enter name only → submit → row appears in the signups list with status `checked_in`, an open session, and hours `0` while open. Repeat with name + email + phone → confirm the corresponding `/users` doc in Firebase console has email + phone populated.

- [ ] **Step 7: Commit**

```bash
git add src/pages/AdminDashboard.jsx
git commit -m "feat(admin): New Walk-In modal for strangers not yet in the system"
```

---

### Task 10: Session-aware per-row buttons + session expander

**Files:**
- Modify: `src/pages/AdminDashboard.jsx`

- [ ] **Step 1: Replace the per-row action logic with session-awareness**

Inside the `{eventSignups.filter(signupMatches).sort(…).map((signup) => …)}` block (around lines 442–479), replace the action block (the `<>{signup.status === 'signed_up' && (<>…</>) }` etc. sub-tree) with a block that uses `getOpenSession`:

```jsx
{(() => {
  const open = getOpenSession(signup)
  if (signup.status === 'released') return <span className="text-xs text-amber-600 font-medium">Released</span>
  if (signup.status === 'no_show') return <span className="text-xs text-red-500 font-medium">No-show</span>
  // Any non-released/no_show signup: button depends on whether a session is open
  if (open) {
    return (<>
      <input type="number" step="0.25" min="0" className="input py-1 text-xs w-16 text-center" placeholder="hrs" value={manualHoursMap[signup.id] || ''} onChange={(e) => setManualHours(signup.id, e.target.value)} title="Override hours (leave blank for auto-calculate)" />
      <button onClick={() => handleCheckOut(signup.id, signup.userId)} disabled={checkInLoading === signup.id} className="btn-primary text-xs py-1 px-3 flex items-center space-x-1"><UserX size={12} /><span>{checkInLoading === signup.id ? '...' : 'Check Out'}</span></button>
      <button onClick={() => handleRelease(signup.id)} disabled={checkInLoading === signup.id} className="text-gray-400 hover:text-amber-500 p-1" title="Release (not needed, 0 hours)"><MinusCircle size={16} /></button>
    </>)
  }
  // No open session — show Check In (even if previously checked out, this starts a new session)
  return (<>
    <button onClick={() => handleCheckIn(signup.id)} disabled={checkInLoading === signup.id} className="btn-primary text-xs py-1 px-3 flex items-center space-x-1"><UserCheck size={12} /><span>{checkInLoading === signup.id ? '...' : 'Check In'}</span></button>
    {signup.status === 'signed_up' && (
      <button onClick={() => handleNoShow(signup.id)} disabled={checkInLoading === signup.id} className="text-gray-400 hover:text-red-500 p-1" title="Mark as no-show"><XCircle size={16} /></button>
    )}
    {(signup.hoursLogged || 0) > 0 && (
      <span className="text-xs text-green-600 font-medium">{formatHours(signup.hoursLogged)} logged</span>
    )}
  </>)
})()}
```

- [ ] **Step 2: Replace the status/timestamp line so it reflects current session**

The existing row header has `{signup.status === 'checked_in' && signup.checkedInAt && (<span> since {…}</span>)}` (around line 450). Replace with:

```jsx
{(() => {
  const open = getOpenSession(signup)
  if (!open) return null
  const when = open.checkInAt?.toDate?.() || open.checkInAt
  const time = when instanceof Date ? when.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : ''
  return <span> since {time}</span>
})()}
```

Also update the status text so a signup with completed sessions followed by a new open session reads `checked in` (not `checked out`): replace `{signup.status.replace('_', ' ')}` on the same line with:

```jsx
{getOpenSession(signup) ? 'checked in' : signup.status.replace('_', ' ')}
```

- [ ] **Step 3: Add an inline sessions summary + expandable list**

Still inside the row, just below the header line (before the action buttons), add:

```jsx
{(() => {
  const sessions = Array.isArray(signup.sessions) ? signup.sessions : []
  if (sessions.length === 0) return null
  const total = sessions.reduce((s, x) => s + (x.hoursLogged || 0), 0)
  const expanded = expandedSignupId === signup.id
  return (
    <div className="mt-1 text-xs text-gray-500">
      <button onClick={() => setExpandedSignupId(expanded ? null : signup.id)} className="inline-flex items-center gap-1 hover:text-gray-700">
        {sessions.length} session{sessions.length === 1 ? '' : 's'} · {formatHours(total)} total
        {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>
      {expanded && (
        <ul className="mt-1 ml-2 space-y-0.5">
          {sessions.map((s, i) => {
            const inAt = s.checkInAt?.toDate?.()?.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) || '—'
            const outAt = s.checkOutAt ? s.checkOutAt.toDate().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : 'open'
            return <li key={i}>{inAt} → {outAt} · {formatHours(s.hoursLogged || 0)}{s.department ? ` · ${getDeptInfo(s.department)?.name || s.department}` : ''}</li>
          })}
        </ul>
      )}
    </div>
  )
})()}
```

Add the supporting state near the other Check-In state (around line 41):

```jsx
const [expandedSignupId, setExpandedSignupId] = useState(null)
```

- [ ] **Step 4: Update bulk handlers to skip signups that already have an open session**

Replace `handleBulkCheckIn` (around line 110–114):

```jsx
async function handleBulkCheckIn() {
  setBulkLoading(true)
  for (const s of eventSignups) {
    if (getOpenSession(s)) continue
    if (s.status === 'released' || s.status === 'no_show') continue
    await checkIn(s.id)
  }
  await refreshSignups(); setBulkLoading(false)
}
```

Replace `handleBulkCheckOut` (around line 116–125):

```jsx
async function handleBulkCheckOut() {
  if (!confirm('Check out all checked-in volunteers?')) return
  setBulkLoading(true)
  for (const s of eventSignups) {
    if (!getOpenSession(s)) continue
    const manual = manualHoursMap[s.id]
    const hours = manual !== undefined && manual !== '' ? Number(manual) : null
    await checkOut(s.id, s.userId, hours)
  }
  setManualHoursMap({}); await refreshSignups(); setBulkLoading(false); await loadData()
}
```

- [ ] **Step 5: Manual verification**

Take one signed-up volunteer through a full multi-session cycle: Check In → see the row shows `1 session · 0.0 h total` with a chevron; click the chevron to see `<time> → open · 0.0 h`. Check Out → row collapses to `checked out`, shows `1 session · X h total`; expand to see `<in> → <out> · X h`. Click **Check In** again on the same row → second open session; expand shows two entries. Check out with manual hours `1.5` → total reflects first session + 1.5.

Bulk check-in on an event with three signed-ups: all three open. Bulk check-out → all three close. On an event with a mix of signed-up, checked-in, and released: bulk check-in only opens the signed-ups; bulk check-out only closes the checked-ins.

- [ ] **Step 6: Commit**

```bash
git add src/pages/AdminDashboard.jsx
git commit -m "feat(admin): session-aware Check-In buttons, session expander, bulk handlers skip released/no-show"
```

---

## Admin Save-Feedback Rollout

### Task 11: Migrate AdminDashboard handlers to `useAsyncAction` + toast

**Files:**
- Modify: `src/pages/AdminDashboard.jsx`

- [ ] **Step 1: Import hooks**

Add near the top of the file:

```jsx
import { useAsyncAction } from '../hooks/useAsyncAction'
import { useToast } from '../contexts/ToastContext'
```

- [ ] **Step 2: Declare inside the component**

Just below the `useState` declarations:

```jsx
const { run } = useAsyncAction()
const toast = useToast()
```

- [ ] **Step 3: Wrap event handlers**

Replace each handler below. The pattern: wrap the existing body in `run(async () => { … }, { successMessage, errorMessage })`; drop `try/catch/alert`.

`handleCreateEvent` (around line 65):
```jsx
async function handleCreateEvent(e) {
  e.preventDefault()
  await run(async () => {
    await createEvent({ ...eventForm, date: Timestamp.fromDate(new Date(eventForm.date)), maxVolunteers: eventForm.maxVolunteers ? Number(eventForm.maxVolunteers) : null, durationHours: eventForm.durationHours ? Number(eventForm.durationHours) : null })
    setShowEventForm(false)
    setEventForm({ title: '', description: '', date: '', location: '', ministryId: '', maxVolunteers: '', durationHours: '' })
    await loadData()
  }, { successMessage: 'Event created', errorMessage: 'Failed to create event' })
}
```

`handleDeleteEvent` (around line 75):
```jsx
async function handleDeleteEvent(id) {
  if (!confirm('Delete this event?')) return
  await run(async () => { await deleteEvent(id); await loadData() }, { successMessage: 'Event deleted', errorMessage: 'Failed to delete event' })
}
```

`handleCreateMinistry` (around line 77):
```jsx
async function handleCreateMinistry(e) {
  e.preventDefault()
  await run(async () => {
    await createMinistry(ministryForm)
    setShowMinistryForm(false)
    setMinistryForm({ name: '', description: '', leaderName: '', contactEmail: '' })
    await loadData()
  }, { successMessage: 'Ministry created', errorMessage: 'Failed to create ministry' })
}
```

`handleDeleteMinistry` (around line 87):
```jsx
async function handleDeleteMinistry(id) {
  if (!confirm('Delete this ministry?')) return
  await run(async () => { await deleteMinistry(id); await loadData() }, { successMessage: 'Ministry deleted', errorMessage: 'Failed to delete ministry' })
}
```

`handleRoleChange` (around line 88):
```jsx
async function handleRoleChange(userId, newRole) {
  await run(async () => { await updateUserRole(userId, newRole); await loadData() }, { successMessage: 'Role updated', errorMessage: 'Failed to update role' })
}
```

`handleCheckIn` (around line 96):
```jsx
async function handleCheckIn(signupId) {
  setCheckInLoading(signupId)
  await run(async () => { await checkIn(signupId); await refreshSignups() }, { successMessage: 'Checked in', errorMessage: 'Check-in failed' })
    .finally(() => setCheckInLoading(null))
}
```

`handleCheckOut` (around line 98):
```jsx
async function handleCheckOut(signupId, userId) {
  setCheckInLoading(signupId)
  const manual = manualHoursMap[signupId]
  const hours = manual !== undefined && manual !== '' ? Number(manual) : null
  await run(async () => {
    await checkOut(signupId, userId, hours)
    setManualHoursMap((prev) => { const n = { ...prev }; delete n[signupId]; return n })
    await refreshSignups()
    await loadData()
  }, { successMessage: 'Checked out', errorMessage: 'Check-out failed' })
    .finally(() => setCheckInLoading(null))
}
```

`handleRelease` and `handleNoShow` (around line 107–108):
```jsx
async function handleRelease(signupId) {
  setCheckInLoading(signupId)
  await run(async () => { await releaseVolunteer(signupId); await refreshSignups() }, { successMessage: 'Released', errorMessage: 'Release failed' })
    .finally(() => setCheckInLoading(null))
}
async function handleNoShow(signupId) {
  setCheckInLoading(signupId)
  await run(async () => { await markNoShow(signupId); await refreshSignups() }, { successMessage: 'Marked no-show', errorMessage: 'Update failed' })
    .finally(() => setCheckInLoading(null))
}
```

`handleAddWalkIn` (around line 127):
```jsx
async function handleAddWalkIn(userId, displayName) {
  await run(async () => {
    await adminAddVolunteer(checkInEventId, userId, displayName)
    setVolunteerSearch('')
    setShowAddVolunteer(false)
    await refreshSignups()
    await loadData()
  }, { successMessage: 'Added to event', errorMessage: 'Could not add' })
}
```

`handleCreateNewWalkIn` (from Task 9):
```jsx
async function handleCreateNewWalkIn(e) {
  e.preventDefault()
  if (!newWalkInForm.displayName.trim()) { toast.error('Name is required'); return }
  await run(async () => {
    await createWalkInVolunteer(checkInEventId, newWalkInForm)
    setNewWalkInForm({ displayName: '', email: '', phone: '' })
    setShowNewWalkIn(false)
    await refreshSignups()
    await loadData()
  }, { successMessage: 'Walk-in added', errorMessage: 'Could not create walk-in' })
}
```

`handleAssignVolunteer` and `handleRemoveFromEvent` (around line 144–158):
```jsx
async function handleAssignVolunteer(eventId, userId, displayName) {
  await run(async () => {
    await signUpForEvent(eventId, userId, displayName)
    const signups = await getEventSignups(eventId)
    setAssignSignups(signups)
    await loadData()
  }, { successMessage: 'Assigned', errorMessage: 'Could not assign' })
}
async function handleRemoveFromEvent(signupId, eventId) {
  await run(async () => {
    await cancelSignup(signupId, eventId)
    const signups = await getEventSignups(eventId)
    setAssignSignups(signups)
    await loadData()
  }, { successMessage: 'Removed from event', errorMessage: 'Could not remove' })
}
```

- [ ] **Step 4: Update inline handlers (Users tab department select, Users tab managed-volunteer form submit, Users tab delete)**

The managed-volunteer add-form submit (around line 334) becomes:

```jsx
onSubmit={async (e) => {
  e.preventDefault()
  if (!volunteerForm.displayName.trim()) { toast.error('Name is required'); return }
  await run(async () => {
    await createManagedVolunteer(volunteerForm)
    setVolunteerForm({ displayName: '', email: '', phone: '' })
    setShowVolunteerForm(false)
    await loadData()
  }, { successMessage: 'Volunteer added', errorMessage: 'Failed to add volunteer' })
}}
```

Department assignment select (around line 358) becomes:

```jsx
onChange={(e) => run(async () => {
  await updateVolunteerProfile(u.id, { assignedDepartment: e.target.value || null })
  await loadData()
}, { successMessage: 'Department updated', errorMessage: 'Update failed' })}
```

Delete volunteer button (around line 364) becomes:

```jsx
onClick={() => {
  if (!confirm(`Delete ${u.displayName}?`)) return
  run(async () => { await deleteVolunteer(u.id); await loadData() }, { successMessage: 'Volunteer deleted', errorMessage: 'Delete failed' })
}}
```

Per-signup department assignment select (Check-In tab, around line 454) becomes:

```jsx
onChange={(e) => run(async () => {
  await assignDepartment(signup.id, e.target.value)
  await refreshSignups()
}, { successMessage: 'Department set', errorMessage: 'Could not set department' })}
```

- [ ] **Step 5: Manual verification**

Run each action: create event, delete event, create ministry, delete ministry, change role, check in, check out, release, no-show, walk-in (existing), new walk-in (stranger), assign volunteer to event, remove volunteer from event, add managed volunteer, department assignment (both Users-tab and Check-In-tab), delete volunteer. For each: observe a green success toast.

Then force a failure: open DevTools → Network tab → check **Offline** → click any action → red sticky error toast shows with the Firestore error text; uncheck **Offline** and dismiss the toast.

- [ ] **Step 6: Commit**

```bash
git add src/pages/AdminDashboard.jsx
git commit -m "refactor(admin): wrap every mutation in useAsyncAction with success/error toasts"
```

---

## Ministry Dropdown Refresh

### Task 12: Migrate AdminDashboard ministry consumers to `useMinistries`

**Files:**
- Modify: `src/pages/AdminDashboard.jsx`

- [ ] **Step 1: Import the hook**

Add to the import block:

```jsx
import { useMinistries } from '../contexts/MinistriesContext'
```

- [ ] **Step 2: Consume the hook and drop local ministries state**

Inside the component, replace:

```jsx
const [ministries, setMinistries] = useState([])
```

with:

```jsx
const { ministries, refresh: refreshMinistries } = useMinistries()
```

Then update `loadData` — remove `getMinistries` from the `Promise.all` and drop `setMinistries(ministriesData)`:

```jsx
async function loadData() {
  try {
    const [usersData, eventsData, hoursData] = await Promise.all([
      getAllUsers(), getEvents(), getServiceHoursSummary(),
    ])
    setUsers(usersData); setEvents(eventsData); setServiceHours(hoursData)
  } catch (err) { console.error('Error loading admin data:', err) }
  setLoading(false)
}
```

Remove the now-unused `getMinistries` from the firestore import block.

- [ ] **Step 3: Call `refreshMinistries()` after any ministry mutation**

In `handleCreateMinistry`, after `loadData()`:
```jsx
await refreshMinistries()
```

Same in `handleDeleteMinistry`. If there's an inline ministry-update handler elsewhere in the file, do the same.

- [ ] **Step 4: Manual verification**

Open two tabs in one browser (same session is fine — this is the in-memory cache, so the update only needs to propagate within ONE React tree, not across browser tabs).

On the Admin page: Go to Ministries tab → create `_wave1_ministry_refresh`. Switch to Events tab → click **New Event** → the Ministry dropdown includes `_wave1_ministry_refresh` without a page reload. Switch to Check-In-assign-department flow (on a signup) → the ministry list (if that UI surfaces ministries — currently it uses `DEPARTMENTS`, which is a fixed list, not ministries) is unaffected.

Delete `_wave1_ministry_refresh` from the Ministries tab. Switch to Events → the New Event form's Ministry dropdown no longer lists it.

- [ ] **Step 5: Commit**

```bash
git add src/pages/AdminDashboard.jsx
git commit -m "refactor(admin): consume ministries via useMinistries so dropdowns stay current"
```

---

### Task 13: LeaderDashboard — consume `useMinistries`, wrap any mutations

**Files:**
- Modify: `src/pages/LeaderDashboard.jsx`

The only Wave 1 change to LeaderDashboard is wiring the hook. Any mutation wrapping depends on whether the approval-gated work (adds approve/reject to this page) has already shipped to `main`.

- [ ] **Step 1: Import and consume the hook**

Add the import:

```jsx
import { useMinistries } from '../contexts/MinistriesContext'
```

Inside the component, replace:

```jsx
const [ministries, setMinistries] = useState([])
```

with:

```jsx
const { ministries } = useMinistries()
```

Drop `getMinistries` from the firestore import and remove `setMinistries(ministriesData)` and the `getMinistries()` entry in the `Promise.all` inside `loadData`:

```jsx
async function loadData() {
  try {
    const [usersData, eventsData] = await Promise.all([
      getAllUsers(), getEvents(),
    ])
    setUsers(usersData)
    setEvents(eventsData)
    // …keep the rest (eventSignupsMap fetch) unchanged
  } catch (err) { console.error('Error loading leader data:', err) }
  setLoading(false)
}
```

- [ ] **Step 2: Conditional — wrap approve/reject if present**

Check whether approve/reject handlers exist in this file:

```bash
grep -n "approveUser\|rejectUser" src/pages/LeaderDashboard.jsx
```

If zero matches, skip this step — LeaderDashboard has no mutations in Wave 1 and nothing to wrap.

If the approval-gated work has landed and handlers exist, add these imports at the top of the file:

```jsx
import { useAsyncAction } from '../hooks/useAsyncAction'
import { useToast } from '../contexts/ToastContext'
```

Declare inside the component (near the top, after `useAuth`):

```jsx
const { run } = useAsyncAction()
const toast = useToast()
```

Replace each handler body with the `run` wrapper. Example for `handleApprove`:

```jsx
async function handleApprove(userId) {
  await run(async () => {
    await approveUser(userId, userProfile.uid)
    await loadData()
  }, { successMessage: 'Approved', errorMessage: 'Approve failed' })
}
```

Example for `handleReject`:

```jsx
async function handleReject(userId) {
  const note = window.prompt('Optional rejection note:') || ''
  await run(async () => {
    await rejectUser(userId, userProfile.uid, note)
    await loadData()
  }, { successMessage: 'Rejected', errorMessage: 'Reject failed' })
}
```

(Replace `userProfile.uid`, the service function names, and the trigger UI bits with whatever the approval-gated work actually shipped — the grep result tells you the exact surface. The pattern above is the only change: drop try/catch + alert, wrap the body in `run(...)` with success/error messages.)

- [ ] **Step 3: Manual verification**

Log in as a ministry_leader test user (or switch a throwaway account's `role` via Firestore console). Load `/leaders` — the page renders; the by-department lists populate. Create a new ministry via the admin Account (separate browser or second tab) → reload `/leaders` and verify ministries are visible (the in-memory cache auto-refreshed because the provider sits above `/leaders` too).

- [ ] **Step 4: Commit**

```bash
git add src/pages/LeaderDashboard.jsx
git commit -m "refactor(leader): consume ministries via useMinistries (+ toast-wrap approvals if present)"
```

---

## Migration

### Task 14: Backfill script for legacy signups

**Files:**
- Create: `scripts/backfill-sessions.mjs`
- (Create directory `scripts/` if it doesn't exist — it doesn't as of this plan's writing.)

- [ ] **Step 1: Write the script**

```js
// scripts/backfill-sessions.mjs
// Run once against prod. Populates `sessions[]` on /eventSignups docs
// that don't have it, synthesizing a single session from the legacy
// checkedInAt/checkedOutAt/hoursLogged/department fields when present.
//
// Usage:
//   export SERVICE_ACCOUNT_KEY="$(cat /path/to/serviceAccount.json)"
//   node scripts/backfill-sessions.mjs
//
// Dry-run flag:
//   DRY_RUN=1 node scripts/backfill-sessions.mjs

import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

if (!process.env.SERVICE_ACCOUNT_KEY) {
  console.error('SERVICE_ACCOUNT_KEY env var is required')
  process.exit(1)
}

initializeApp({ credential: cert(JSON.parse(process.env.SERVICE_ACCOUNT_KEY)) })
const db = getFirestore()
const DRY = process.env.DRY_RUN === '1'

const snap = await db.collection('eventSignups').get()
console.log(`Inspecting ${snap.size} eventSignups docs…`)

let toUpdate = []
for (const doc of snap.docs) {
  const data = doc.data()
  if (Array.isArray(data.sessions)) continue
  const sessions = data.checkedInAt
    ? [{
        checkInAt: data.checkedInAt,
        checkOutAt: data.checkedOutAt || null,
        hoursLogged: data.hoursLogged || 0,
        department: data.department || null,
      }]
    : []
  toUpdate.push({ ref: doc.ref, sessions, id: doc.id })
}

console.log(`Will update ${toUpdate.length} docs.`)
if (DRY) { console.log('DRY_RUN=1 — exiting without writes.'); process.exit(0) }

let batch = db.batch()
let count = 0
for (const { ref, sessions } of toUpdate) {
  batch.update(ref, { sessions })
  count++
  if (count % 400 === 0) {
    await batch.commit()
    console.log(`Committed ${count}…`)
    batch = db.batch()
  }
}
if (count % 400 !== 0) await batch.commit()
console.log(`Backfilled ${count} eventSignups docs.`)
```

- [ ] **Step 2: Dry-run locally against prod Firestore**

```bash
cd C:/Users/HansE/Configurator-Field
export SERVICE_ACCOUNT_KEY="$(cat /path/to/service-account.json)"
DRY_RUN=1 node scripts/backfill-sessions.mjs
```

Expected: `Will update N docs.` where N is the current count of pre-Wave-1 signups. No writes. If `N` looks wildly off (e.g., 0 when you know there should be many, or a number larger than total signups), stop and investigate before running live.

- [ ] **Step 3: Commit the script (not the service account key!)**

```bash
git add scripts/backfill-sessions.mjs
git commit -m "chore: backfill-sessions.mjs for Wave 1 schema migration"
```

(The live run against prod happens in Task 15's rollout sequence.)

---

## Rollout & Final Verification

### Task 15: Smoke test and prod rollout

**Files:** none changed (this task is the rollout sequence from the spec).

- [ ] **Step 1: Push the branch, open a PR**

```bash
git push -u origin wave1-field-test-fixes
gh pr create --title "Wave 1: field-test fixes" --body "$(cat <<'EOF'
## Summary
- Multi-session check-in/out on `eventSignups.sessions[]`
- Strangers-as-walk-ins flow + New Walk-In modal
- Volunteer search on Check-In signup list
- Toast-based save feedback across all admin mutations
- Shared `useMinistries` so ministry dropdowns stay current

## Test plan
- [ ] Vercel preview loads, login works
- [ ] Full smoke checklist from spec ran on preview
- [ ] Backfill dry-run count matches expected legacy signup count

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 2: Full preview smoke checklist**

Run every item below against the Vercel preview URL (created by the PR). Use throwaway test users (`_wave1_*` prefix). Delete test records when done.

- [ ] Admin adds a new managed volunteer with email and phone → Users tab row shows both fields populated.
- [ ] Admin searches Check-In by name (≥2 chars) and by email → both filter correctly.
- [ ] Admin clicks **New Walk-In** with name only → creates a user + first open session; toast fires.
- [ ] Admin clicks **Add Walk-In** and picks an existing volunteer → session opens on that signup.
- [ ] Admin checks in an existing signup → row shows one open session; expand shows `<time> → open`.
- [ ] Admin checks them out with default (clock) hours → row shows one closed session; `attendanceLogs` gained a row; `serviceHours` gained a row; `users.totalHours` incremented.
- [ ] Admin checks the same volunteer back in → second open session; expand shows two entries.
- [ ] Admin checks them out with `manualHours = 1.5` → second session records 1.5 h; parent `hoursLogged` sums correctly.
- [ ] Admin assigns a department to an open session → session's `department` updates AND parent's `department` updates.
- [ ] Admin releases a checked-in volunteer → row shows `Released`; no new log row; no hours incremented.
- [ ] Admin marks a signed-up volunteer as no-show → row shows `No-show`.
- [ ] Admin creates a new ministry → the New Event form's Ministry dropdown includes it without a page reload.
- [ ] Admin deletes a ministry → it disappears from the same dropdown.
- [ ] Every action above showed a green toast or a red error toast — no silent save.
- [ ] Force a save failure (offline the devtools network for 3 s) → red sticky toast with error message; row state unchanged.
- [ ] Legacy signup (from before Wave 1) renders: if sessions[] missing, `getOpenSession` fallback uses legacy fields; if backfilled, session expander shows one entry.
- [ ] Approval-gated behavior (if shipped): pending volunteer still blocked from event signup; admin approval flow unchanged.

If any item fails, stop — fix on the branch, push, re-run. Do not merge.

- [ ] **Step 3: Merge to main**

Merge the PR via GitHub UI. Vercel auto-deploys `main` to production.

- [ ] **Step 4: Backfill prod**

```bash
DRY_RUN=1 node scripts/backfill-sessions.mjs   # verify the count
node scripts/backfill-sessions.mjs             # live
```

Spot-check 3–5 docs in the Firebase console: a past signup now has a one-element `sessions` array whose `checkInAt`/`checkOutAt`/`hoursLogged` match the legacy fields; a never-checked-in signup has `sessions: []`.

- [ ] **Step 5: Prod smoke**

- [ ] Open an admin account on prod. Load Check-In for a past event → sessions render via the expander.
- [ ] Live check-in on a current event → appends a fresh session.
- [ ] Create + delete a `_wave1_final_smoke` ministry on prod → admin dropdown updates; delete it.
- [ ] Sanity: Leaderboard totals unchanged from pre-backfill (if tracked; otherwise spot-check one top user's `totalHours` in the Firebase console before and after).

- [ ] **Step 6: Clean up**

Delete test users and throwaway signups from Firestore. Delete the local branch once merged: `git checkout main && git pull && git branch -d wave1-field-test-fixes`.

---

## Notes for the engineer

- **Why wrappers around `checkIn`/`checkOut`:** existing code paths (Events page self-signup, LeaderDashboard reads) will be audited and migrated off these wrappers in a Wave-2 cleanup. Don't delete them in Wave 1 — keeping them keeps the blast radius small.
- **Why `useMinistries` is in-memory only:** Wave 2 adds real-time sync; Wave 1 intentionally matches today's behavior (cache is per-React-tree, not cross-tab).
- **Email/phone on managed volunteers:** the inputs already exist on the Users tab form (`src/pages/AdminDashboard.jsx:339-340`). The user's complaint mapped onto the walk-in flow, which Task 9 covers. Don't add duplicate fields on the Users tab form.
- **If the approval-gated spec isn't merged yet when Wave 1 starts:** Task 13 Step 2 becomes a no-op; otherwise it wraps the approve/reject handlers with `useAsyncAction`. Either way, Wave 1 doesn't block on approval-gated.
