# Production Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild VolunteerHub into a production deployment ready app with Firebase Auth, Firestore, Cloud Functions, strong rules, admin approval, strict attendance control, accountless volunteers, claim codes, tests, and deployment runbooks.

**Architecture:** Keep the React/Vite frontend on Vercel and Firebase for Auth/Firestore. Move privileged writes into Firebase Cloud Functions using the Admin SDK. Use deny-by-default Firestore rules, emulator-backed tests, and role-aware frontend flows.

**Tech Stack:** React 18, Vite 5, Tailwind CSS, Firebase Auth, Firestore, Firebase Cloud Functions v2 callable functions, Firebase Admin SDK, Firebase Emulator Suite, Vitest, @firebase/rules-unit-testing, Playwright.

---

## Scope Check

The approved spec covers multiple subsystems: tooling, Cloud Functions, rules, approval, ministries/events, attendance, managed volunteers, claim codes, frontend refactors, tests, and deployment. This plan is intentionally phased. Each task produces a working checkpoint and should be committed before moving on.

Execution should happen in an isolated worktree created at execution time with `superpowers:using-git-worktrees`.

Official Firebase references checked while writing this plan:

- Firestore rules emulator tests: https://firebase.google.com/docs/firestore/security/test-rules-emulator
- Rules unit testing package: https://firebase.google.com/docs/reference/emulator-suite/rules-unit-testing/rules-unit-testing
- Cloud Functions local emulator: https://firebase.google.com/docs/functions/local-emulator
- Local Emulator Suite setup: https://firebase.google.com/docs/emulator-suite/install_and_configure

## File Structure

New top-level structure:

- `functions/`: Firebase Cloud Functions package.
- `functions/src/index.js`: exports callable functions.
- `functions/src/admin.js`: Admin SDK initialization.
- `functions/src/authz.js`: shared authorization helpers.
- `functions/src/audit.js`: audit log helper.
- `functions/src/users.js`: user approval, role, managed volunteer, claim-code actions.
- `functions/src/ministries.js`: ministry actions.
- `functions/src/events.js`: event and signup actions.
- `functions/src/attendance.js`: attendance/session actions.
- `functions/src/gamification.js`: server-side points, badges, streak helpers.
- `functions/test/*.test.js`: function unit/integration tests.
- `src/lib/schema.js`: frontend shared constants.
- `src/lib/callables.js`: typed-ish callable wrappers.
- `src/lib/format.js`: shared formatting utilities.
- `src/contexts/ToastContext.jsx`: app toast state.
- `src/components/Notice.jsx`: inline status banner.
- `src/components/Dialog.jsx`: reusable confirmation/dialog shell.
- `src/pages/PendingApproval.jsx`: pending/rejected account page.
- `src/pages/admin/*`: split admin workflow components.
- `src/pages/leader/*`: leader workflow components.
- `tests/rules/*.test.js`: Firestore rules tests.
- `tests/e2e/*.spec.js`: Playwright smoke tests.
- `scripts/promote-first-admin.mjs`: first admin setup.
- `scripts/seed-launch-data.mjs`: clean launch seed data.
- `scripts/reset-launch-data.mjs`: guarded reset script.
- `docs/production-runbook.md`: launch/deployment runbook.

Existing files to modify:

- `package.json`
- `firebase.json`
- `firestore.rules`
- `firestore.indexes.json`
- `.env.example`
- `src/firebase.js`
- `src/main.jsx`
- `src/App.jsx`
- `src/contexts/AuthContext.jsx`
- `src/components/Navbar.jsx`
- `src/services/firestore.js`
- `src/pages/Login.jsx`
- `src/pages/Register.jsx`
- `src/pages/Events.jsx`
- `src/pages/Profile.jsx`
- `src/pages/AdminDashboard.jsx`
- `src/pages/LeaderDashboard.jsx`

---

### Task 1: Baseline, Lockfile, And Tooling

**Files:**
- Modify: `package.json`
- Create: `package-lock.json`
- Create: `eslint.config.js`
- Create: `vitest.config.js`
- Create: `playwright.config.js`

- [ ] **Step 1: Capture current branch and status**

Run:

```powershell
git branch --show-current
git status --short
git rev-parse HEAD
```

Expected: current branch is the execution branch/worktree branch. Only known untracked local state such as `.superpowers/` may appear.

- [ ] **Step 2: Install root dependencies**

Run:

```powershell
npm.cmd install
```

Expected: `package-lock.json` is created and install completes.

- [ ] **Step 3: Install test and lint dependencies**

Run:

```powershell
npm.cmd install --save-dev vitest jsdom @testing-library/react @testing-library/jest-dom @firebase/rules-unit-testing firebase-tools @playwright/test eslint @eslint/js eslint-plugin-react eslint-plugin-react-hooks globals
```

Expected: dev dependencies are added to `package.json` and `package-lock.json`.

- [ ] **Step 4: Replace root scripts**

Edit `package.json` scripts to:

```json
{
  "dev": "vite",
  "build": "vite build",
  "preview": "vite preview",
  "lint": "eslint .",
  "test": "vitest run",
  "test:watch": "vitest",
  "test:rules": "firebase emulators:exec --only firestore \"vitest run tests/rules\"",
  "test:functions": "firebase emulators:exec --only firestore,auth,functions \"npm.cmd --prefix functions test\"",
  "test:e2e": "playwright test",
  "emulator": "firebase emulators:start --only auth,firestore,functions,hosting",
  "deploy:firebase": "firebase deploy --only firestore:rules,firestore:indexes,functions",
  "seed:launch": "node scripts/seed-launch-data.mjs",
  "promote:admin": "node scripts/promote-first-admin.mjs"
}
```

- [ ] **Step 5: Add ESLint config**

Create `eslint.config.js`:

```js
import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'

export default [
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx}'],
    ignores: ['dist/**', 'node_modules/**', 'functions/lib/**'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
    },
    rules: {
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
    settings: {
      react: { version: 'detect' },
    },
  },
]
```

- [ ] **Step 6: Add Vitest config**

Create `vitest.config.js`:

```js
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.js'],
  },
})
```

- [ ] **Step 7: Add test setup**

Create `tests/setup.js`:

```js
import '@testing-library/jest-dom/vitest'
```

- [ ] **Step 8: Add Playwright config**

Create `playwright.config.js`:

```js
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:5173',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm.cmd run dev -- --host 127.0.0.1',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
})
```

- [ ] **Step 9: Run baseline checks**

Run:

```powershell
npm.cmd run lint
npm.cmd run build
npm.cmd run test
```

Expected: build passes. Lint may expose current warnings/errors; fix only mechanical lint errors introduced by new config before committing.

- [ ] **Step 10: Commit**

Run:

```powershell
git add package.json package-lock.json eslint.config.js vitest.config.js playwright.config.js tests/setup.js
git commit -m "chore: add production test and lint tooling"
```

---

### Task 2: Firebase Emulator And Environment Configuration

**Files:**
- Modify: `firebase.json`
- Modify: `.env.example`
- Modify: `src/firebase.js`

- [ ] **Step 1: Update Firebase config**

Replace `firebase.json` with:

```json
{
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      { "source": "**", "destination": "/index.html" }
    ]
  },
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "functions": {
    "source": "functions",
    "runtime": "nodejs20"
  },
  "emulators": {
    "auth": { "port": 9099 },
    "firestore": { "port": 8080 },
    "functions": { "port": 5001 },
    "hosting": { "port": 5000 },
    "ui": { "enabled": true, "port": 4000 },
    "singleProjectMode": true
  }
}
```

- [ ] **Step 2: Update environment example**

Replace `.env.example` with:

```dotenv
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id

# Local development only. Set to true to connect Auth, Firestore, and Functions to emulators.
VITE_USE_FIREBASE_EMULATORS=false
```

- [ ] **Step 3: Connect frontend SDKs to emulators**

Replace `src/firebase.js` with:

```js
import { initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth, GoogleAuthProvider } from 'firebase/auth'
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore'
import { connectFunctionsEmulator, getFunctions } from 'firebase/functions'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = getFirestore(app)
export const functions = getFunctions(app)
export const googleProvider = new GoogleAuthProvider()

if (import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true') {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
  connectFunctionsEmulator(functions, '127.0.0.1', 5001)
}

export default app
```

- [ ] **Step 4: Verify**

Run:

```powershell
npm.cmd run build
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```powershell
git add firebase.json .env.example src/firebase.js
git commit -m "chore: configure Firebase emulators"
```

---

### Task 3: Shared Schema Constants

**Files:**
- Create: `src/lib/schema.js`
- Create: `src/lib/schema.test.js`

- [ ] **Step 1: Write schema constants**

Create `src/lib/schema.js`:

```js
export const ROLES = Object.freeze({
  PENDING: 'pending',
  VOLUNTEER: 'volunteer',
  MINISTRY_LEADER: 'ministry_leader',
  ADMIN: 'admin',
})

export const APPROVAL_STATUS = Object.freeze({
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
})

export const EVENT_STATUS = Object.freeze({
  DRAFT: 'draft',
  ACTIVE: 'active',
  CANCELLED: 'cancelled',
  COMPLETED: 'completed',
})

export const SIGNUP_STATUS = Object.freeze({
  SIGNED_UP: 'signed_up',
  CHECKED_IN: 'checked_in',
  CHECKED_OUT: 'checked_out',
  RELEASED: 'released',
  NO_SHOW: 'no_show',
  CANCELLED: 'cancelled',
})

export const SIGNUP_SOURCE = Object.freeze({
  SELF: 'self',
  ADMIN: 'admin',
  WALK_IN: 'walk_in',
})

export function isPrivilegedRole(role) {
  return role === ROLES.ADMIN || role === ROLES.MINISTRY_LEADER
}

export function isApprovedProfile(profile) {
  return profile?.approvalStatus === APPROVAL_STATUS.APPROVED
}
```

- [ ] **Step 2: Write schema tests**

Create `src/lib/schema.test.js`:

```js
import { describe, expect, it } from 'vitest'
import { APPROVAL_STATUS, ROLES, isApprovedProfile, isPrivilegedRole } from './schema'

describe('schema helpers', () => {
  it('detects privileged roles', () => {
    expect(isPrivilegedRole(ROLES.ADMIN)).toBe(true)
    expect(isPrivilegedRole(ROLES.MINISTRY_LEADER)).toBe(true)
    expect(isPrivilegedRole(ROLES.VOLUNTEER)).toBe(false)
    expect(isPrivilegedRole(ROLES.PENDING)).toBe(false)
  })

  it('detects approved profiles', () => {
    expect(isApprovedProfile({ approvalStatus: APPROVAL_STATUS.APPROVED })).toBe(true)
    expect(isApprovedProfile({ approvalStatus: APPROVAL_STATUS.PENDING })).toBe(false)
    expect(isApprovedProfile(null)).toBe(false)
  })
})
```

- [ ] **Step 3: Verify**

Run:

```powershell
npm.cmd run test -- src/lib/schema.test.js
npm.cmd run build
```

Expected: tests and build pass.

- [ ] **Step 4: Commit**

Run:

```powershell
git add src/lib/schema.js src/lib/schema.test.js
git commit -m "feat: add shared schema constants"
```

---

### Task 4: Cloud Functions Package Scaffold

**Files:**
- Create: `functions/package.json`
- Create: `functions/src/admin.js`
- Create: `functions/src/errors.js`
- Create: `functions/src/authz.js`
- Create: `functions/src/audit.js`
- Create: `functions/src/index.js`
- Create: `functions/test/authz.test.js`

- [ ] **Step 1: Create functions package**

Create `functions/package.json`:

```json
{
  "name": "volunteerhub-functions",
  "private": true,
  "type": "module",
  "main": "src/index.js",
  "engines": {
    "node": "20"
  },
  "scripts": {
    "lint": "eslint .",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "firebase-admin": "latest",
    "firebase-functions": "latest",
    "nanoid": "latest"
  },
  "devDependencies": {
    "vitest": "latest"
  }
}
```

- [ ] **Step 2: Install functions dependencies**

Run:

```powershell
npm.cmd install --prefix functions
```

Expected: `functions/package-lock.json` is created.

- [ ] **Step 3: Create Admin SDK module**

Create `functions/src/admin.js`:

```js
import { initializeApp, getApps } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore'

if (getApps().length === 0) {
  initializeApp()
}

export const adminAuth = getAuth()
export const db = getFirestore()
export { FieldValue, Timestamp }
```

- [ ] **Step 4: Create error helpers**

Create `functions/src/errors.js`:

```js
import { HttpsError } from 'firebase-functions/v2/https'

export function failedPrecondition(message) {
  return new HttpsError('failed-precondition', message)
}

export function invalidArgument(message) {
  return new HttpsError('invalid-argument', message)
}

export function notFound(message) {
  return new HttpsError('not-found', message)
}

export function permissionDenied(message) {
  return new HttpsError('permission-denied', message)
}

export function unauthenticated() {
  return new HttpsError('unauthenticated', 'Sign in is required.')
}
```

- [ ] **Step 5: Create authorization helpers**

Create `functions/src/authz.js`:

```js
import { unauthenticated, permissionDenied } from './errors.js'

export const ROLES = Object.freeze({
  PENDING: 'pending',
  VOLUNTEER: 'volunteer',
  MINISTRY_LEADER: 'ministry_leader',
  ADMIN: 'admin',
})

export async function getActor(db, request) {
  const uid = request.auth?.uid
  if (!uid) throw unauthenticated()
  const snap = await db.collection('users').doc(uid).get()
  if (!snap.exists) throw permissionDenied('User profile is missing.')
  return { id: snap.id, ...snap.data() }
}

export function assertAdmin(actor) {
  if (actor?.role !== ROLES.ADMIN) {
    throw permissionDenied('Admin access is required.')
  }
}

export function assertLeaderOrAdmin(actor) {
  if (actor?.role !== ROLES.ADMIN && actor?.role !== ROLES.MINISTRY_LEADER) {
    throw permissionDenied('Leader or admin access is required.')
  }
}

export function canManageEvent(actor, event) {
  if (actor?.role === ROLES.ADMIN) return true
  if (actor?.role !== ROLES.MINISTRY_LEADER) return false
  const assigned = Array.isArray(actor.assignedMinistryIds) ? actor.assignedMinistryIds : []
  return Boolean(event?.ministryId && assigned.includes(event.ministryId))
}

export function assertCanManageEvent(actor, event) {
  if (!canManageEvent(actor, event)) {
    throw permissionDenied('You cannot manage this event.')
  }
}
```

- [ ] **Step 6: Create audit helper**

Create `functions/src/audit.js`:

```js
import { FieldValue } from './admin.js'

export async function writeAuditLog(db, { actor, action, targetType, targetId, metadata = {} }) {
  await db.collection('auditLogs').add({
    actorId: actor?.id || null,
    actorRole: actor?.role || null,
    action,
    targetType,
    targetId,
    metadata,
    createdAt: FieldValue.serverTimestamp(),
  })
}
```

- [ ] **Step 7: Create initial callable index**

Create `functions/src/index.js`:

```js
import { onCall } from 'firebase-functions/v2/https'

export const ping = onCall(() => ({ ok: true, service: 'volunteerhub-functions' }))
```

- [ ] **Step 8: Create authz tests**

Create `functions/test/authz.test.js`:

```js
import { describe, expect, it } from 'vitest'
import { ROLES, canManageEvent } from '../src/authz.js'

describe('canManageEvent', () => {
  it('allows admins to manage any event', () => {
    expect(canManageEvent({ role: ROLES.ADMIN }, { ministryId: 'kids' })).toBe(true)
  })

  it('allows leaders to manage assigned ministry events', () => {
    const actor = { role: ROLES.MINISTRY_LEADER, assignedMinistryIds: ['kids'] }
    expect(canManageEvent(actor, { ministryId: 'kids' })).toBe(true)
  })

  it('blocks leaders from unassigned ministry events', () => {
    const actor = { role: ROLES.MINISTRY_LEADER, assignedMinistryIds: ['kids'] }
    expect(canManageEvent(actor, { ministryId: 'youth' })).toBe(false)
  })

  it('blocks volunteers', () => {
    expect(canManageEvent({ role: ROLES.VOLUNTEER }, { ministryId: 'kids' })).toBe(false)
  })
})
```

- [ ] **Step 9: Verify**

Run:

```powershell
npm.cmd --prefix functions test
npm.cmd run build
```

Expected: tests and build pass.

- [ ] **Step 10: Commit**

Run:

```powershell
git add functions package.json package-lock.json firebase.json
git commit -m "feat: scaffold Firebase Cloud Functions"
```

---

### Task 5: Strong Firestore Rules And Rules Tests

**Files:**
- Replace: `firestore.rules`
- Create: `tests/rules/firestore-rules.test.js`

- [ ] **Step 1: Replace Firestore rules**

Replace `firestore.rules` with:

```js
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    function signedIn() {
      return request.auth != null;
    }

    function currentUserDoc() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid));
    }

    function currentUser() {
      return currentUserDoc().data;
    }

    function role() {
      return signedIn() && currentUserDoc().exists() ? currentUser().role : null;
    }

    function isAdmin() {
      return role() == 'admin';
    }

    function isLeader() {
      return role() == 'ministry_leader';
    }

    function isApproved() {
      return signedIn()
        && currentUserDoc().exists()
        && currentUser().approvalStatus == 'approved'
        && currentUser().role in ['volunteer', 'ministry_leader', 'admin'];
    }

    function isSelf(userId) {
      return signedIn() && request.auth.uid == userId;
    }

    function onlySafeProfileFieldsChanged() {
      return request.resource.data.diff(resource.data).affectedKeys()
        .hasOnly(['displayName', 'phone', 'photoURL', 'updatedAt']);
    }

    function isAssignedToMinistry(ministryId) {
      return isLeader()
        && ministryId is string
        && currentUser().assignedMinistryIds is list
        && currentUser().assignedMinistryIds.hasAny([ministryId]);
    }

    match /users/{userId} {
      allow read: if signedIn() && (isSelf(userId) || isAdmin() || isLeader());
      allow create: if false;
      allow update: if isSelf(userId) && onlySafeProfileFieldsChanged();
      allow delete: if false;
    }

    match /ministries/{ministryId} {
      allow read: if signedIn();
      allow create, update, delete: if false;
    }

    match /events/{eventId} {
      allow read: if signedIn();
      allow create, update, delete: if false;
    }

    match /eventSignups/{signupId} {
      allow read: if signedIn() && (
        isAdmin()
        || resource.data.userId == request.auth.uid
        || isAssignedToMinistry(resource.data.ministryId)
      );
      allow create, update, delete: if false;
    }

    match /attendanceLogs/{logId} {
      allow read: if signedIn() && (
        isAdmin()
        || resource.data.userId == request.auth.uid
        || isAssignedToMinistry(resource.data.ministryId)
      );
      allow create, update, delete: if false;
    }

    match /serviceHours/{hourId} {
      allow read: if signedIn() && (
        isAdmin()
        || resource.data.userId == request.auth.uid
        || isAssignedToMinistry(resource.data.ministryId)
      );
      allow create, update, delete: if false;
    }

    match /claimCodes/{claimCodeId} {
      allow read, write: if false;
    }

    match /auditLogs/{auditLogId} {
      allow read: if isAdmin();
      allow create, update, delete: if false;
    }

    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

- [ ] **Step 2: Write rules tests**

Create `tests/rules/firestore-rules.test.js`:

```js
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing'
import { readFileSync } from 'node:fs'
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore'

let testEnv

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'volunteerhub-rules-test',
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  })
})

beforeEach(async () => {
  await testEnv.clearFirestore()
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore()
    await setDoc(doc(db, 'users/admin'), {
      role: 'admin',
      approvalStatus: 'approved',
      displayName: 'Admin',
    })
    await setDoc(doc(db, 'users/leader'), {
      role: 'ministry_leader',
      approvalStatus: 'approved',
      assignedMinistryIds: ['kids'],
      displayName: 'Leader',
    })
    await setDoc(doc(db, 'users/volunteer'), {
      role: 'volunteer',
      approvalStatus: 'approved',
      displayName: 'Volunteer',
      totalHours: 0,
    })
    await setDoc(doc(db, 'users/pending'), {
      role: 'pending',
      approvalStatus: 'pending',
      displayName: 'Pending',
    })
    await setDoc(doc(db, 'ministries/kids'), { name: 'Kids', active: true })
    await setDoc(doc(db, 'events/event1'), {
      title: 'Sunday Kids',
      ministryId: 'kids',
      status: 'active',
    })
    await setDoc(doc(db, 'eventSignups/signup1'), {
      userId: 'volunteer',
      eventId: 'event1',
      ministryId: 'kids',
      status: 'signed_up',
    })
    await setDoc(doc(db, 'attendanceLogs/log1'), {
      userId: 'volunteer',
      eventId: 'event1',
      ministryId: 'kids',
      hoursLogged: 1,
    })
  })
})

afterAll(async () => {
  await testEnv.cleanup()
})

function authed(uid) {
  return testEnv.authenticatedContext(uid, { uid }).firestore()
}

describe('users rules', () => {
  it('allows users to read themselves', async () => {
    await assertSucceeds(getDoc(doc(authed('volunteer'), 'users/volunteer')))
  })

  it('blocks self role escalation', async () => {
    await assertFails(updateDoc(doc(authed('volunteer'), 'users/volunteer'), {
      role: 'admin',
    }))
  })

  it('allows safe profile updates', async () => {
    await assertSucceeds(updateDoc(doc(authed('volunteer'), 'users/volunteer'), {
      displayName: 'New Name',
    }))
  })

  it('blocks direct user creation', async () => {
    await assertFails(setDoc(doc(authed('newUser'), 'users/newUser'), {
      role: 'volunteer',
    }))
  })
})

describe('sensitive writes', () => {
  it('blocks client event signup creation', async () => {
    await assertFails(setDoc(doc(authed('volunteer'), 'eventSignups/newSignup'), {
      userId: 'volunteer',
      eventId: 'event1',
      ministryId: 'kids',
      status: 'signed_up',
    }))
  })

  it('blocks client attendance log creation', async () => {
    await assertFails(setDoc(doc(authed('leader'), 'attendanceLogs/newLog'), {
      userId: 'volunteer',
      eventId: 'event1',
      ministryId: 'kids',
      hoursLogged: 2,
    }))
  })

  it('blocks claim code reads', async () => {
    await assertFails(getDoc(doc(authed('admin'), 'claimCodes/secret')))
  })
})

describe('scoped reads', () => {
  it('allows assigned leader to read signup', async () => {
    await assertSucceeds(getDoc(doc(authed('leader'), 'eventSignups/signup1')))
  })

  it('allows volunteer to read own signup', async () => {
    await assertSucceeds(getDoc(doc(authed('volunteer'), 'eventSignups/signup1')))
  })
})
```

- [ ] **Step 3: Run rules tests**

Run:

```powershell
npm.cmd run test:rules
```

Expected: all rules tests pass.

- [ ] **Step 4: Commit**

Run:

```powershell
git add firestore.rules tests/rules/firestore-rules.test.js
git commit -m "test: lock down Firestore rules"
```

---

### Task 6: User Profile, Approval, And Role Functions

**Files:**
- Create: `functions/src/users.js`
- Modify: `functions/src/index.js`
- Create: `functions/test/users.test.js`
- Create: `scripts/promote-first-admin.mjs`

- [ ] **Step 1: Write user functions module**

Create `functions/src/users.js`:

```js
import { createHash, randomBytes } from 'node:crypto'
import { nanoid } from 'nanoid'
import { adminAuth, db, FieldValue, Timestamp } from './admin.js'
import { assertAdmin, assertLeaderOrAdmin, getActor, ROLES } from './authz.js'
import { failedPrecondition, invalidArgument, notFound, permissionDenied } from './errors.js'
import { writeAuditLog } from './audit.js'

export const APPROVAL_STATUS = Object.freeze({
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
})

function cleanString(value, fieldName, { required = false, max = 200 } = {}) {
  const text = typeof value === 'string' ? value.trim() : ''
  if (required && !text) throw invalidArgument(`${fieldName} is required.`)
  if (text.length > max) throw invalidArgument(`${fieldName} is too long.`)
  return text
}

function hashCode(code) {
  return createHash('sha256').update(code).digest('hex')
}

export async function ensureUserProfileImpl({ actorUid, authToken }) {
  if (!actorUid) throw permissionDenied('Authenticated user is required.')
  const ref = db.collection('users').doc(actorUid)
  const snap = await ref.get()
  if (snap.exists) return { id: snap.id, ...snap.data() }

  const email = cleanString(authToken?.email || '', 'email', { max: 320 })
  const displayName = cleanString(authToken?.name || authToken?.displayName || email, 'displayName', { max: 120 })
  const now = FieldValue.serverTimestamp()
  const profile = {
    uid: actorUid,
    email,
    displayName,
    phone: '',
    photoURL: authToken?.picture || '',
    role: ROLES.PENDING,
    approvalStatus: APPROVAL_STATUS.PENDING,
    approvalNote: '',
    approvedBy: null,
    approvedAt: null,
    managed: false,
    claimed: true,
    claimedBy: actorUid,
    claimedAt: now,
    assignedMinistryIds: [],
    totalHours: 0,
    totalPoints: 0,
    badges: [],
    streak: 0,
    lastServedDate: null,
    createdAt: now,
    updatedAt: now,
    createdBy: actorUid,
    updatedBy: actorUid,
  }
  await ref.set(profile)
  await adminAuth.setCustomUserClaims(actorUid, { role: ROLES.PENDING })
  return { id: actorUid, ...profile }
}

export async function approveUserImpl({ actor, targetUserId }) {
  assertAdmin(actor)
  const targetRef = db.collection('users').doc(targetUserId)
  const targetSnap = await targetRef.get()
  if (!targetSnap.exists) throw notFound('User not found.')
  const target = targetSnap.data()
  if (target.approvalStatus === APPROVAL_STATUS.APPROVED) {
    return { ok: true, alreadyApproved: true }
  }
  await targetRef.update({
    role: ROLES.VOLUNTEER,
    approvalStatus: APPROVAL_STATUS.APPROVED,
    approvalNote: '',
    approvedBy: actor.id,
    approvedAt: FieldValue.serverTimestamp(),
    updatedBy: actor.id,
    updatedAt: FieldValue.serverTimestamp(),
  })
  if (target.uid) {
    await adminAuth.setCustomUserClaims(target.uid, { role: ROLES.VOLUNTEER })
  }
  await writeAuditLog(db, {
    actor,
    action: 'user.approve',
    targetType: 'user',
    targetId: targetUserId,
  })
  return { ok: true }
}

export async function rejectUserImpl({ actor, targetUserId, approvalNote = '' }) {
  assertAdmin(actor)
  const note = cleanString(approvalNote, 'approvalNote', { max: 500 })
  const targetRef = db.collection('users').doc(targetUserId)
  const targetSnap = await targetRef.get()
  if (!targetSnap.exists) throw notFound('User not found.')
  await targetRef.update({
    role: ROLES.PENDING,
    approvalStatus: APPROVAL_STATUS.REJECTED,
    approvalNote: note,
    approvedBy: actor.id,
    approvedAt: FieldValue.serverTimestamp(),
    updatedBy: actor.id,
    updatedAt: FieldValue.serverTimestamp(),
  })
  const target = targetSnap.data()
  if (target.uid) {
    await adminAuth.setCustomUserClaims(target.uid, { role: ROLES.PENDING })
  }
  await writeAuditLog(db, {
    actor,
    action: 'user.reject',
    targetType: 'user',
    targetId: targetUserId,
    metadata: { hasNote: Boolean(note) },
  })
  return { ok: true }
}

export async function setUserRoleImpl({ actor, targetUserId, role, assignedMinistryIds = [] }) {
  assertAdmin(actor)
  if (!Object.values(ROLES).includes(role) || role === ROLES.PENDING) {
    throw invalidArgument('Role must be volunteer, ministry_leader, or admin.')
  }
  const targetRef = db.collection('users').doc(targetUserId)
  const targetSnap = await targetRef.get()
  if (!targetSnap.exists) throw notFound('User not found.')
  const target = targetSnap.data()
  const ministries = Array.isArray(assignedMinistryIds) ? assignedMinistryIds.filter(Boolean) : []
  await targetRef.update({
    role,
    approvalStatus: APPROVAL_STATUS.APPROVED,
    assignedMinistryIds: ministries,
    updatedBy: actor.id,
    updatedAt: FieldValue.serverTimestamp(),
  })
  if (target.uid) {
    await adminAuth.setCustomUserClaims(target.uid, { role })
  }
  await writeAuditLog(db, {
    actor,
    action: 'user.setRole',
    targetType: 'user',
    targetId: targetUserId,
    metadata: { role, assignedMinistryIds: ministries },
  })
  return { ok: true }
}

export async function createManagedVolunteerImpl({ actor, data }) {
  assertLeaderOrAdmin(actor)
  const displayName = cleanString(data?.displayName, 'displayName', { required: true, max: 120 })
  const email = cleanString(data?.email || '', 'email', { max: 320 })
  const phone = cleanString(data?.phone || '', 'phone', { max: 40 })
  const assignedMinistryIds = Array.isArray(data?.assignedMinistryIds) ? data.assignedMinistryIds.filter(Boolean) : []
  if (actor.role === ROLES.MINISTRY_LEADER) {
    const allowed = new Set(actor.assignedMinistryIds || [])
    if (assignedMinistryIds.some((id) => !allowed.has(id))) {
      throw permissionDenied('Leader cannot assign outside their ministries.')
    }
  }
  const ref = db.collection('users').doc()
  await ref.set({
    uid: null,
    email,
    displayName,
    phone,
    photoURL: '',
    role: ROLES.VOLUNTEER,
    approvalStatus: APPROVAL_STATUS.APPROVED,
    approvalNote: '',
    approvedBy: actor.id,
    approvedAt: FieldValue.serverTimestamp(),
    managed: true,
    claimed: false,
    claimedBy: null,
    claimedAt: null,
    assignedMinistryIds,
    totalHours: 0,
    totalPoints: 0,
    badges: [],
    streak: 0,
    lastServedDate: null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    createdBy: actor.id,
    updatedBy: actor.id,
  })
  await writeAuditLog(db, {
    actor,
    action: 'user.createManaged',
    targetType: 'user',
    targetId: ref.id,
  })
  return { ok: true, userId: ref.id }
}

export async function createClaimCodeImpl({ actor, managedUserId }) {
  assertAdmin(actor)
  const userRef = db.collection('users').doc(managedUserId)
  const userSnap = await userRef.get()
  if (!userSnap.exists) throw notFound('Managed volunteer not found.')
  const user = userSnap.data()
  if (!user.managed || user.claimed) throw failedPrecondition('Profile is not claimable.')
  const code = `${nanoid(6)}-${nanoid(6)}-${randomBytes(2).toString('hex')}`.toUpperCase()
  const ref = db.collection('claimCodes').doc()
  await ref.set({
    managedUserId,
    codeHash: hashCode(code),
    expiresAt: Timestamp.fromMillis(Date.now() + 14 * 24 * 60 * 60 * 1000),
    usedAt: null,
    usedBy: null,
    createdAt: FieldValue.serverTimestamp(),
    createdBy: actor.id,
    revokedAt: null,
    revokedBy: null,
  })
  await writeAuditLog(db, {
    actor,
    action: 'claimCode.create',
    targetType: 'user',
    targetId: managedUserId,
  })
  return { ok: true, claimCodeId: ref.id, code }
}

export async function claimManagedProfileImpl({ actorUid, code }) {
  const cleanCode = cleanString(code, 'code', { required: true, max: 80 }).toUpperCase()
  const codeHash = hashCode(cleanCode)
  const snap = await db.collection('claimCodes').where('codeHash', '==', codeHash).limit(1).get()
  if (snap.empty) throw notFound('Claim code not found.')
  const codeDoc = snap.docs[0]
  const claim = codeDoc.data()
  if (claim.revokedAt || claim.usedAt) throw failedPrecondition('Claim code is no longer valid.')
  if (claim.expiresAt.toMillis() < Date.now()) throw failedPrecondition('Claim code has expired.')
  const managedRef = db.collection('users').doc(claim.managedUserId)
  const authProfileRef = db.collection('users').doc(actorUid)
  await db.runTransaction(async (tx) => {
    const managedSnap = await tx.get(managedRef)
    if (!managedSnap.exists) throw notFound('Managed profile not found.')
    const managed = managedSnap.data()
    if (!managed.managed || managed.claimed) throw failedPrecondition('Profile has already been claimed.')
    const authSnap = await tx.get(authProfileRef)
    if (authSnap.exists && authSnap.id !== managedRef.id) {
      tx.delete(authProfileRef)
    }
    tx.update(managedRef, {
      uid: actorUid,
      managed: false,
      claimed: true,
      claimedBy: actorUid,
      claimedAt: FieldValue.serverTimestamp(),
      updatedBy: actorUid,
      updatedAt: FieldValue.serverTimestamp(),
    })
    tx.update(codeDoc.ref, {
      usedAt: FieldValue.serverTimestamp(),
      usedBy: actorUid,
    })
  })
  await adminAuth.setCustomUserClaims(actorUid, { role: ROLES.VOLUNTEER })
  return { ok: true, userId: claim.managedUserId }
}

export async function ensureUserProfile(request) {
  return ensureUserProfileImpl({ actorUid: request.auth?.uid, authToken: request.auth?.token })
}

export async function approveUser(request) {
  const actor = await getActor(db, request)
  return approveUserImpl({ actor, targetUserId: request.data?.userId })
}

export async function rejectUser(request) {
  const actor = await getActor(db, request)
  return rejectUserImpl({ actor, targetUserId: request.data?.userId, approvalNote: request.data?.approvalNote })
}

export async function setUserRole(request) {
  const actor = await getActor(db, request)
  return setUserRoleImpl({
    actor,
    targetUserId: request.data?.userId,
    role: request.data?.role,
    assignedMinistryIds: request.data?.assignedMinistryIds || [],
  })
}

export async function createManagedVolunteer(request) {
  const actor = await getActor(db, request)
  return createManagedVolunteerImpl({ actor, data: request.data || {} })
}

export async function createClaimCode(request) {
  const actor = await getActor(db, request)
  return createClaimCodeImpl({ actor, managedUserId: request.data?.managedUserId })
}

export async function claimManagedProfile(request) {
  return claimManagedProfileImpl({ actorUid: request.auth?.uid, code: request.data?.code })
}
```

- [ ] **Step 2: Export user callables**

Replace `functions/src/index.js` with:

```js
import { onCall } from 'firebase-functions/v2/https'
import {
  approveUser,
  claimManagedProfile,
  createClaimCode,
  createManagedVolunteer,
  ensureUserProfile,
  rejectUser,
  setUserRole,
} from './users.js'

const callableOptions = {
  region: 'us-central1',
  cors: true,
}

export const ping = onCall(callableOptions, () => ({ ok: true, service: 'volunteerhub-functions' }))
export const ensureProfile = onCall(callableOptions, ensureUserProfile)
export const approvePendingUser = onCall(callableOptions, approveUser)
export const rejectPendingUser = onCall(callableOptions, rejectUser)
export const updateUserRole = onCall(callableOptions, setUserRole)
export const createManagedVolunteerProfile = onCall(callableOptions, createManagedVolunteer)
export const createProfileClaimCode = onCall(callableOptions, createClaimCode)
export const claimManagedVolunteerProfile = onCall(callableOptions, claimManagedProfile)
```

- [ ] **Step 3: Create first admin promotion script**

Create `scripts/promote-first-admin.mjs`:

```js
import { initializeApp, cert, applicationDefault } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

const email = process.env.ADMIN_EMAIL
if (!email) {
  console.error('ADMIN_EMAIL is required. Example: $env:ADMIN_EMAIL=\"admin@example.com\"')
  process.exit(1)
}

if (process.env.SERVICE_ACCOUNT_KEY) {
  initializeApp({ credential: cert(JSON.parse(process.env.SERVICE_ACCOUNT_KEY)) })
} else {
  initializeApp({ credential: applicationDefault() })
}

const auth = getAuth()
const db = getFirestore()
const user = await auth.getUserByEmail(email)

await db.collection('users').doc(user.uid).set({
  uid: user.uid,
  email: user.email || email,
  displayName: user.displayName || email,
  phone: '',
  photoURL: user.photoURL || '',
  role: 'admin',
  approvalStatus: 'approved',
  approvalNote: '',
  approvedBy: 'setup-script',
  approvedAt: FieldValue.serverTimestamp(),
  managed: false,
  claimed: true,
  claimedBy: user.uid,
  claimedAt: FieldValue.serverTimestamp(),
  assignedMinistryIds: [],
  totalHours: 0,
  totalPoints: 0,
  badges: [],
  streak: 0,
  lastServedDate: null,
  createdAt: FieldValue.serverTimestamp(),
  updatedAt: FieldValue.serverTimestamp(),
  createdBy: 'setup-script',
  updatedBy: 'setup-script',
}, { merge: true })

await auth.setCustomUserClaims(user.uid, { role: 'admin' })
console.log(`Promoted ${email} (${user.uid}) to admin.`)
```

- [ ] **Step 4: Add smoke test for authz module and function imports**

Create `functions/test/users.test.js`:

```js
import { describe, expect, it } from 'vitest'
import { APPROVAL_STATUS } from '../src/users.js'

describe('users module', () => {
  it('exports approval statuses', () => {
    expect(APPROVAL_STATUS.PENDING).toBe('pending')
    expect(APPROVAL_STATUS.APPROVED).toBe('approved')
    expect(APPROVAL_STATUS.REJECTED).toBe('rejected')
  })
})
```

- [ ] **Step 5: Verify**

Run:

```powershell
npm.cmd --prefix functions test
npm.cmd run build
```

Expected: tests and build pass.

- [ ] **Step 6: Commit**

Run:

```powershell
git add functions/src functions/test scripts/promote-first-admin.mjs package.json package-lock.json
git commit -m "feat: add user approval and role functions"
```

---

### Task 7: Frontend Callable Wrappers And Auth Context

**Files:**
- Create: `src/lib/callables.js`
- Modify: `src/contexts/AuthContext.jsx`
- Modify: `src/App.jsx`
- Create: `src/pages/PendingApproval.jsx`
- Create: `src/components/Notice.jsx`

- [ ] **Step 1: Create callable wrappers**

Create `src/lib/callables.js`:

```js
import { httpsCallable } from 'firebase/functions'
import { functions } from '../firebase'

function callable(name) {
  const fn = httpsCallable(functions, name)
  return async (data = {}) => {
    const result = await fn(data)
    return result.data
  }
}

export const api = {
  ensureProfile: callable('ensureProfile'),
  approvePendingUser: callable('approvePendingUser'),
  rejectPendingUser: callable('rejectPendingUser'),
  updateUserRole: callable('updateUserRole'),
  createManagedVolunteerProfile: callable('createManagedVolunteerProfile'),
  createProfileClaimCode: callable('createProfileClaimCode'),
  claimManagedVolunteerProfile: callable('claimManagedVolunteerProfile'),
}
```

- [ ] **Step 2: Create Notice component**

Create `src/components/Notice.jsx`:

```jsx
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react'

const styles = {
  info: { Icon: Info, className: 'border-blue-200 bg-blue-50 text-blue-800' },
  success: { Icon: CheckCircle2, className: 'border-green-200 bg-green-50 text-green-800' },
  warning: { Icon: AlertTriangle, className: 'border-amber-200 bg-amber-50 text-amber-800' },
  error: { Icon: XCircle, className: 'border-red-200 bg-red-50 text-red-800' },
}

export default function Notice({ type = 'info', title, children }) {
  const { Icon, className } = styles[type] || styles.info
  return (
    <div className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${className}`} role={type === 'error' ? 'alert' : 'status'}>
      <Icon size={18} className="mt-0.5 shrink-0" />
      <div className="min-w-0">
        {title && <p className="font-semibold">{title}</p>}
        <div>{children}</div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Replace AuthContext**

Replace `src/contexts/AuthContext.jsx` with:

```jsx
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
```

- [ ] **Step 4: Add PendingApproval page**

Create `src/pages/PendingApproval.jsx`:

```jsx
import { Link } from 'react-router-dom'
import Notice from '../components/Notice'
import { useAuth } from '../contexts/AuthContext'

export default function PendingApproval() {
  const { userProfile, isRejected, logout } = useAuth()

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Account Review</h1>
        <p className="mt-1 text-sm text-gray-500">
          {userProfile?.displayName || userProfile?.email || 'Your account'} is not approved for volunteer signups yet.
        </p>
      </div>

      {isRejected ? (
        <Notice type="error" title="Account not approved">
          {userProfile?.approvalNote || 'Please contact an admin for next steps.'}
        </Notice>
      ) : (
        <Notice type="info" title="Pending admin approval">
          An admin will review your account. You can browse ministries and events while you wait.
        </Notice>
      )}

      <div className="flex flex-wrap gap-2">
        <Link className="btn-secondary" to="/events">Browse Events</Link>
        <Link className="btn-secondary" to="/ministries">Browse Ministries</Link>
        <button className="btn-primary" onClick={logout}>Sign Out</button>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Wire protected routes**

Replace `src/App.jsx` with:

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
        <Route path="/pending-approval" element={<PendingApproval />} />
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
          <ProtectedRoute requiredRole="admin">
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

- [ ] **Step 6: Verify**

Run:

```powershell
npm.cmd run test
npm.cmd run build
```

Expected: tests and build pass.

- [ ] **Step 7: Commit**

Run:

```powershell
git add src/lib/callables.js src/components/Notice.jsx src/contexts/AuthContext.jsx src/pages/PendingApproval.jsx src/App.jsx
git commit -m "feat: route auth through Cloud Functions"
```

---

### Task 8: Route Guards, Navbar, And Registration UI

**Files:**
- Modify: `src/components/ProtectedRoute.jsx`
- Modify: `src/components/Navbar.jsx`
- Modify: `src/pages/Register.jsx`
- Modify: `src/pages/Login.jsx`

- [ ] **Step 1: Replace ProtectedRoute**

Replace `src/components/ProtectedRoute.jsx`:

```jsx
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function ProtectedRoute({ children, requiredRole, requireApproved = false }) {
  const { currentUser, loading, role, isApproved, isRejected } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary-600" />
      </div>
    )
  }

  if (!currentUser) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (requiredRole) {
    const allowed = Array.isArray(requiredRole) ? requiredRole : [requiredRole]
    if (!allowed.includes(role)) return <Navigate to="/dashboard" replace />
  }

  if (requireApproved && !isApproved) {
    return <Navigate to={isRejected ? '/profile' : '/pending-approval'} replace />
  }

  return children
}
```

- [ ] **Step 2: Update Navbar role links**

Modify `src/components/Navbar.jsx` to build links from `isApproved`, `isAdmin`, and `isLeader`. The link list must include events/ministries for signed-in users, dashboard/leaderboard/badges only for approved users, leaders only for leaders/admins, and admin only for admins.

Use this link construction:

```jsx
const navLinks = []
if (isApproved) navLinks.push({ to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard })
navLinks.push({ to: '/events', label: 'Events', icon: Calendar })
navLinks.push({ to: '/ministries', label: 'Ministries', icon: Users })
if (isApproved) {
  navLinks.push({ to: '/leaderboard', label: 'Leaderboard', icon: Trophy })
  navLinks.push({ to: '/badges', label: 'Badges', icon: Award })
}
if (isPending || isRejected) navLinks.unshift({ to: '/pending-approval', label: isRejected ? 'Not Approved' : 'Pending', icon: Clock })
if (isAdmin || isLeader) navLinks.push({ to: '/leaders', label: 'Leaders', icon: ClipboardList })
if (isAdmin) navLinks.push({ to: '/admin', label: 'Admin', icon: LayoutDashboard })
```

- [ ] **Step 3: Update registration redirect**

In `src/pages/Register.jsx`, after successful email/password or Google registration, navigate to `/pending-approval`, not `/dashboard`.

Replace the success path in `handleSubmit` with:

```jsx
await register(email, password, displayName)
navigate('/pending-approval')
```

Replace the success path in `handleGoogle` with:

```jsx
await loginWithGoogle()
navigate('/pending-approval')
```

- [ ] **Step 4: Update login redirect**

In `src/pages/Login.jsx`, after successful login, navigate pending users to `/pending-approval` and approved users to `/dashboard`. If `login()` returns before profile state updates, call `refreshProfile()`.

Update the auth destructuring to include `refreshProfile`:

```jsx
const { login, loginWithGoogle, refreshProfile } = useAuth()
```

Replace the success path in `handleSubmit` with:

```jsx
await login(email, password)
const profile = await refreshProfile()
navigate(profile?.approvalStatus === 'approved' ? '/dashboard' : '/pending-approval')
```

Replace the success path in `handleGoogle` with:

```jsx
await loginWithGoogle()
const profile = await refreshProfile()
navigate(profile?.approvalStatus === 'approved' ? '/dashboard' : '/pending-approval')
```

- [ ] **Step 5: Verify**

Run:

```powershell
npm.cmd run lint
npm.cmd run build
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```powershell
git add src/components/ProtectedRoute.jsx src/components/Navbar.jsx src/pages/Register.jsx src/pages/Login.jsx
git commit -m "feat: enforce approval-aware navigation"
```

---

### Task 9: Admin Approvals UI

**Files:**
- Create: `src/contexts/ToastContext.jsx`
- Create: `src/components/Toast.jsx`
- Create: `src/pages/admin/AdminApprovals.jsx`
- Modify: `src/pages/AdminDashboard.jsx`

- [ ] **Step 1: Add toast context**

Create `src/contexts/ToastContext.jsx`:

```jsx
import { createContext, useCallback, useContext, useMemo, useState } from 'react'

const ToastContext = createContext(null)
let nextToastId = 1

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const dismiss = useCallback((id) => {
    setToasts((items) => items.filter((item) => item.id !== id))
  }, [])

  const push = useCallback((type, message) => {
    const id = nextToastId++
    setToasts((items) => [...items.slice(-2), { id, type, message }])
    if (type !== 'error') window.setTimeout(() => dismiss(id), 3500)
  }, [dismiss])

  const api = useMemo(() => ({
    success: (message) => push('success', message),
    info: (message) => push('info', message),
    error: (message) => push('error', message),
    dismiss,
  }), [dismiss, push])

  return <ToastContext.Provider value={{ toasts, api }}>{children}</ToastContext.Provider>
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used inside ToastProvider')
  return context.api
}

export function useToastState() {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToastState must be used inside ToastProvider')
  return context
}
```

- [ ] **Step 2: Add toast component**

Create `src/components/Toast.jsx`:

```jsx
import { CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { useToastState } from '../contexts/ToastContext'

const style = {
  success: 'border-green-200 bg-green-50 text-green-800',
  info: 'border-blue-200 bg-blue-50 text-blue-800',
  error: 'border-red-200 bg-red-50 text-red-800',
}

const icon = {
  success: CheckCircle2,
  info: Info,
  error: XCircle,
}

export default function ToastContainer() {
  const { toasts, api } = useToastState()
  if (toasts.length === 0) return null
  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 max-w-[calc(100vw-2rem)] space-y-2">
      {toasts.map((toast) => {
        const Icon = icon[toast.type] || Info
        return (
          <div key={toast.id} className={`flex items-start gap-2 rounded-lg border p-3 text-sm shadow-sm ${style[toast.type]}`}>
            <Icon size={16} className="mt-0.5 shrink-0" />
            <p className="flex-1">{toast.message}</p>
            <button aria-label="Dismiss" onClick={() => api.dismiss(toast.id)}><X size={14} /></button>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 3: Wire toast provider**

Replace `src/main.jsx` with:

```jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './contexts/AuthContext'
import { ToastProvider } from './contexts/ToastContext'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
```

Replace `src/components/Layout.jsx` with:

```jsx
import { Outlet } from 'react-router-dom'
import Navbar from './Navbar'
import ToastContainer from './Toast'

export default function Layout() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Outlet />
      </main>
      <ToastContainer />
    </div>
  )
}
```

- [ ] **Step 4: Create AdminApprovals component**

Create `src/pages/admin/AdminApprovals.jsx`:

```jsx
import { useEffect, useState } from 'react'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '../../firebase'
import { api } from '../../lib/callables'
import { useToast } from '../../contexts/ToastContext'

export default function AdminApprovals() {
  const toast = useToast()
  const [pendingUsers, setPendingUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)

  async function loadPendingUsers() {
    setLoading(true)
    const q = query(collection(db, 'users'), where('approvalStatus', '==', 'pending'))
    const snap = await getDocs(q)
    setPendingUsers(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })))
    setLoading(false)
  }

  useEffect(() => {
    loadPendingUsers()
  }, [])

  async function approve(userId) {
    setBusyId(userId)
    try {
      await api.approvePendingUser({ userId })
      toast.success('User approved')
      await loadPendingUsers()
    } catch (err) {
      toast.error(err.message || 'Approval failed')
    } finally {
      setBusyId(null)
    }
  }

  async function reject(userId) {
    const approvalNote = window.prompt('Optional rejection note') || ''
    setBusyId(userId)
    try {
      await api.rejectPendingUser({ userId, approvalNote })
      toast.success('User rejected')
      await loadPendingUsers()
    } catch (err) {
      toast.error(err.message || 'Rejection failed')
    } finally {
      setBusyId(null)
    }
  }

  if (loading) return <p className="text-sm text-gray-500">Loading pending approvals...</p>

  return (
    <section className="card">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Pending Approvals</h2>
        <span className="badge bg-blue-100 text-blue-700">{pendingUsers.length} pending</span>
      </div>
      {pendingUsers.length === 0 ? (
        <p className="text-sm text-gray-500">No pending users need review.</p>
      ) : (
        <div className="space-y-3">
          {pendingUsers.map((user) => (
            <div key={user.id} className="flex flex-col gap-3 rounded-lg border border-gray-100 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium">{user.displayName || user.email}</p>
                <p className="text-sm text-gray-500">{user.email || 'No email'}</p>
              </div>
              <div className="flex gap-2">
                <button className="btn-primary text-sm" disabled={busyId === user.id} onClick={() => approve(user.id)}>
                  {busyId === user.id ? 'Working...' : 'Approve'}
                </button>
                <button className="btn-secondary text-sm" disabled={busyId === user.id} onClick={() => reject(user.id)}>
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
```

- [ ] **Step 5: Render in AdminDashboard overview**

Import and render `AdminApprovals` near the top of `src/pages/AdminDashboard.jsx` overview tab:

```jsx
import AdminApprovals from './admin/AdminApprovals'
```

Inside overview:

```jsx
<AdminApprovals />
```

- [ ] **Step 6: Verify**

Run:

```powershell
npm.cmd run lint
npm.cmd run build
```

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```powershell
git add src/contexts/ToastContext.jsx src/components/Toast.jsx src/main.jsx src/components/Layout.jsx src/pages/admin/AdminApprovals.jsx src/pages/AdminDashboard.jsx
git commit -m "feat: add admin approval workflow"
```

---

### Task 10: Ministries, Events, And Signup Functions

**Files:**
- Create: `functions/src/ministries.js`
- Create: `functions/src/events.js`
- Modify: `functions/src/index.js`
- Modify: `src/lib/callables.js`
- Modify: `src/services/firestore.js`
- Modify: `src/pages/Events.jsx`
- Modify: `src/pages/AdminDashboard.jsx`

- [ ] **Step 1: Implement ministry functions**

Create `functions/src/ministries.js`:

```js
import { db, FieldValue } from './admin.js'
import { assertAdmin, getActor } from './authz.js'
import { invalidArgument, notFound } from './errors.js'
import { writeAuditLog } from './audit.js'

function cleanName(name) {
  const value = typeof name === 'string' ? name.trim() : ''
  if (!value) throw invalidArgument('Ministry name is required.')
  if (value.length > 120) throw invalidArgument('Ministry name is too long.')
  return value
}

export async function upsertMinistry(request) {
  const actor = await getActor(db, request)
  assertAdmin(actor)
  const id = request.data?.id || db.collection('ministries').doc().id
  const name = cleanName(request.data?.name)
  const ref = db.collection('ministries').doc(id)
  await ref.set({
    name,
    description: typeof request.data?.description === 'string' ? request.data.description.trim() : '',
    active: request.data?.active !== false,
    displayOrder: Number(request.data?.displayOrder || 0),
    leaderIds: Array.isArray(request.data?.leaderIds) ? request.data.leaderIds.filter(Boolean) : [],
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: actor.id,
    createdAt: FieldValue.serverTimestamp(),
    createdBy: actor.id,
  }, { merge: true })
  await writeAuditLog(db, { actor, action: 'ministry.upsert', targetType: 'ministry', targetId: id })
  return { ok: true, ministryId: id }
}

export async function archiveMinistry(request) {
  const actor = await getActor(db, request)
  assertAdmin(actor)
  const id = request.data?.id
  if (!id) throw invalidArgument('Ministry id is required.')
  const ref = db.collection('ministries').doc(id)
  const snap = await ref.get()
  if (!snap.exists) throw notFound('Ministry not found.')
  await ref.update({ active: false, updatedAt: FieldValue.serverTimestamp(), updatedBy: actor.id })
  await writeAuditLog(db, { actor, action: 'ministry.archive', targetType: 'ministry', targetId: id })
  return { ok: true }
}
```

- [ ] **Step 2: Implement event and signup functions**

Create `functions/src/events.js`:

```js
import { db, FieldValue, Timestamp } from './admin.js'
import { assertAdmin, getActor, ROLES } from './authz.js'
import { failedPrecondition, invalidArgument, notFound } from './errors.js'
import { writeAuditLog } from './audit.js'

function cleanText(value, fieldName, required = false) {
  const text = typeof value === 'string' ? value.trim() : ''
  if (required && !text) throw invalidArgument(`${fieldName} is required.`)
  return text
}

export async function upsertEvent(request) {
  const actor = await getActor(db, request)
  assertAdmin(actor)
  const id = request.data?.id || db.collection('events').doc().id
  const title = cleanText(request.data?.title, 'title', true)
  const dateMs = Number(request.data?.dateMs)
  if (!Number.isFinite(dateMs)) throw invalidArgument('Valid event date is required.')
  const ministryId = cleanText(request.data?.ministryId, 'ministryId', true)
  await db.collection('events').doc(id).set({
    title,
    description: cleanText(request.data?.description, 'description'),
    date: Timestamp.fromMillis(dateMs),
    location: cleanText(request.data?.location, 'location'),
    ministryId,
    maxVolunteers: request.data?.maxVolunteers ? Number(request.data.maxVolunteers) : null,
    durationHours: request.data?.durationHours ? Number(request.data.durationHours) : null,
    status: request.data?.status || 'active',
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: actor.id,
    createdAt: FieldValue.serverTimestamp(),
    createdBy: actor.id,
  }, { merge: true })
  await writeAuditLog(db, { actor, action: 'event.upsert', targetType: 'event', targetId: id })
  return { ok: true, eventId: id }
}

export async function signUpForEvent(request) {
  const actor = await getActor(db, request)
  if (actor.role === ROLES.PENDING || actor.approvalStatus !== 'approved') {
    throw failedPrecondition('Approval is required before signing up.')
  }
  const eventId = request.data?.eventId
  if (!eventId) throw invalidArgument('Event id is required.')
  const eventRef = db.collection('events').doc(eventId)
  const eventSnap = await eventRef.get()
  if (!eventSnap.exists) throw notFound('Event not found.')
  const event = eventSnap.data()
  if (event.status !== 'active') throw failedPrecondition('Event is not active.')

  const existing = await db.collection('eventSignups')
    .where('eventId', '==', eventId)
    .where('userId', '==', actor.id)
    .limit(1)
    .get()
  if (!existing.empty) throw failedPrecondition('Already signed up.')

  if (event.maxVolunteers) {
    const signups = await db.collection('eventSignups').where('eventId', '==', eventId).get()
    if (signups.size >= event.maxVolunteers) throw failedPrecondition('Event is full.')
  }

  const signupRef = db.collection('eventSignups').doc()
  await signupRef.set({
    eventId,
    userId: actor.id,
    userNameSnapshot: actor.displayName || actor.email || 'Volunteer',
    status: 'signed_up',
    source: 'self',
    ministryId: event.ministryId,
    departmentId: event.ministryId,
    sessions: [],
    hoursLogged: 0,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    createdBy: actor.id,
    updatedBy: actor.id,
  })
  await eventRef.update({ signupCount: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() })
  await writeAuditLog(db, { actor, action: 'event.signup', targetType: 'eventSignup', targetId: signupRef.id, metadata: { eventId } })
  return { ok: true, signupId: signupRef.id }
}
```

- [ ] **Step 3: Export functions**

Add to `functions/src/index.js`:

```js
import { archiveMinistry, upsertMinistry } from './ministries.js'
import { signUpForEvent, upsertEvent } from './events.js'

export const saveMinistry = onCall(callableOptions, upsertMinistry)
export const disableMinistry = onCall(callableOptions, archiveMinistry)
export const saveEvent = onCall(callableOptions, upsertEvent)
export const createEventSignup = onCall(callableOptions, signUpForEvent)
```

- [ ] **Step 4: Add frontend wrappers**

Add to `src/lib/callables.js`:

```js
saveMinistry: callable('saveMinistry'),
disableMinistry: callable('disableMinistry'),
saveEvent: callable('saveEvent'),
createEventSignup: callable('createEventSignup'),
```

- [ ] **Step 5: Update volunteer event signup**

In `src/pages/Events.jsx`, replace direct `signUpForEvent(eventId, userProfile.uid, userProfile.displayName)` with:

```js
await api.createEventSignup({ eventId })
```

Disable signup buttons when `!isApproved`.

- [ ] **Step 6: Verify**

Run:

```powershell
npm.cmd --prefix functions test
npm.cmd run lint
npm.cmd run build
```

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```powershell
git add functions/src src/lib/callables.js src/pages/Events.jsx src/pages/AdminDashboard.jsx src/services/firestore.js
git commit -m "feat: move ministries events and signups to functions"
```

---

### Task 11: Attendance Sessions And Leader Scope

**Files:**
- Create: `functions/src/gamification.js`
- Create: `functions/src/attendance.js`
- Modify: `functions/src/index.js`
- Modify: `src/lib/callables.js`
- Modify: `src/pages/AdminDashboard.jsx`
- Modify: `src/pages/LeaderDashboard.jsx`

- [ ] **Step 1: Add server gamification helpers**

Create `functions/src/gamification.js`:

```js
export const POINTS_PER_HOUR = 10

export function pointsForHours(hours) {
  return Math.max(0, Math.floor(Number(hours || 0) * POINTS_PER_HOUR))
}

export function badgeIdsForUser(user) {
  const hours = Number(user.totalHours || 0)
  const points = Number(user.totalPoints || 0)
  const badges = []
  if (hours > 0) badges.push('first_event')
  if (hours >= 10) badges.push('hours_10')
  if (hours >= 50) badges.push('hours_50')
  if (hours >= 100) badges.push('hours_100')
  if (hours >= 250) badges.push('hours_250')
  if (points >= 500) badges.push('points_500')
  if (points >= 2000) badges.push('points_2000')
  return badges
}
```

- [ ] **Step 2: Add attendance functions**

Create `functions/src/attendance.js`:

```js
import { db, FieldValue, Timestamp } from './admin.js'
import { assertCanManageEvent, getActor } from './authz.js'
import { failedPrecondition, invalidArgument, notFound } from './errors.js'
import { pointsForHours, badgeIdsForUser } from './gamification.js'
import { writeAuditLog } from './audit.js'

function currentOpenSession(signup) {
  const sessions = Array.isArray(signup.sessions) ? signup.sessions : []
  const last = sessions[sessions.length - 1]
  return last && !last.checkOutAt ? { index: sessions.length - 1, session: last } : null
}

async function loadSignupEvent(signupId) {
  const signupRef = db.collection('eventSignups').doc(signupId)
  const signupSnap = await signupRef.get()
  if (!signupSnap.exists) throw notFound('Signup not found.')
  const signup = { id: signupSnap.id, ...signupSnap.data() }
  const eventSnap = await db.collection('events').doc(signup.eventId).get()
  if (!eventSnap.exists) throw notFound('Event not found.')
  return { signupRef, signup, event: { id: eventSnap.id, ...eventSnap.data() } }
}

export async function checkInVolunteer(request) {
  const actor = await getActor(db, request)
  const signupId = request.data?.signupId
  if (!signupId) throw invalidArgument('Signup id is required.')
  const { signupRef, signup, event } = await loadSignupEvent(signupId)
  assertCanManageEvent(actor, event)
  if (currentOpenSession(signup)) throw failedPrecondition('Volunteer is already checked in.')
  const now = Timestamp.now()
  const sessions = Array.isArray(signup.sessions) ? signup.sessions : []
  sessions.push({
    checkInAt: now,
    checkInBy: actor.id,
    checkOutAt: null,
    checkOutBy: null,
    hoursLogged: 0,
    ministryId: signup.ministryId || event.ministryId,
    departmentId: signup.departmentId || event.ministryId,
  })
  await signupRef.update({
    sessions,
    status: 'checked_in',
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: actor.id,
  })
  await writeAuditLog(db, { actor, action: 'attendance.checkIn', targetType: 'eventSignup', targetId: signupId, metadata: { eventId: event.id } })
  return { ok: true }
}

export async function checkOutVolunteer(request) {
  const actor = await getActor(db, request)
  const signupId = request.data?.signupId
  if (!signupId) throw invalidArgument('Signup id is required.')
  const manualHours = request.data?.manualHours
  const { signupRef, signup, event } = await loadSignupEvent(signupId)
  assertCanManageEvent(actor, event)
  const open = currentOpenSession(signup)
  if (!open) throw failedPrecondition('Volunteer is not checked in.')
  const now = Timestamp.now()
  const start = open.session.checkInAt.toDate()
  const hours = manualHours !== undefined && manualHours !== null && manualHours !== ''
    ? Number(manualHours)
    : Math.round(((now.toMillis() - start.getTime()) / (1000 * 60 * 60)) * 100) / 100
  if (!Number.isFinite(hours) || hours < 0) throw invalidArgument('Hours must be zero or greater.')
  const sessions = [...signup.sessions]
  sessions[open.index] = {
    ...open.session,
    checkOutAt: now,
    checkOutBy: actor.id,
    hoursLogged: hours,
  }
  const totalSignupHours = sessions.reduce((sum, session) => sum + Number(session.hoursLogged || 0), 0)
  const points = pointsForHours(hours)
  const userRef = db.collection('users').doc(signup.userId)
  const userSnap = await userRef.get()
  if (!userSnap.exists) throw notFound('Volunteer profile not found.')
  const user = userSnap.data()
  const nextTotalHours = Number(user.totalHours || 0) + hours
  const nextTotalPoints = Number(user.totalPoints || 0) + points
  const nextBadges = [...new Set([...(user.badges || []), ...badgeIdsForUser({ ...user, totalHours: nextTotalHours, totalPoints: nextTotalPoints })])]
  const attendanceRef = db.collection('attendanceLogs').doc()
  const serviceRef = db.collection('serviceHours').doc()
  await db.runTransaction(async (tx) => {
    tx.update(signupRef, {
      sessions,
      status: 'checked_out',
      hoursLogged: totalSignupHours,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: actor.id,
    })
    tx.set(attendanceRef, {
      eventId: event.id,
      signupId,
      userId: signup.userId,
      checkInAt: open.session.checkInAt,
      checkOutAt: now,
      hoursLogged: hours,
      ministryId: signup.ministryId || event.ministryId,
      departmentId: signup.departmentId || event.ministryId,
      actorIds: [actor.id],
      createdAt: FieldValue.serverTimestamp(),
    })
    tx.set(serviceRef, {
      userId: signup.userId,
      eventId: event.id,
      signupId,
      attendanceLogId: attendanceRef.id,
      hours,
      points,
      date: now,
      ministryId: signup.ministryId || event.ministryId,
      departmentId: signup.departmentId || event.ministryId,
      createdAt: FieldValue.serverTimestamp(),
    })
    tx.update(userRef, {
      totalHours: FieldValue.increment(hours),
      totalPoints: FieldValue.increment(points),
      badges: nextBadges,
      lastServedDate: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: actor.id,
    })
  })
  await writeAuditLog(db, { actor, action: 'attendance.checkOut', targetType: 'eventSignup', targetId: signupId, metadata: { eventId: event.id, hours, points } })
  return { ok: true, hoursLogged: hours, pointsEarned: points }
}
```

- [ ] **Step 3: Export attendance callables**

Add to `functions/src/index.js`:

```js
import { checkInVolunteer, checkOutVolunteer } from './attendance.js'

export const checkInEventVolunteer = onCall(callableOptions, checkInVolunteer)
export const checkOutEventVolunteer = onCall(callableOptions, checkOutVolunteer)
```

- [ ] **Step 4: Add frontend wrappers**

Add to `src/lib/callables.js`:

```js
checkInEventVolunteer: callable('checkInEventVolunteer'),
checkOutEventVolunteer: callable('checkOutEventVolunteer'),
```

- [ ] **Step 5: Replace check-in/out UI calls**

In `src/pages/AdminDashboard.jsx` and `src/pages/LeaderDashboard.jsx`, replace direct `checkIn(signupId)` and `checkOut(signupId, userId, hours)` calls with:

```js
await api.checkInEventVolunteer({ signupId })
await api.checkOutEventVolunteer({ signupId, manualHours: hours })
```

- [ ] **Step 6: Verify**

Run:

```powershell
npm.cmd --prefix functions test
npm.cmd run lint
npm.cmd run build
```

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```powershell
git add functions/src src/lib/callables.js src/pages/AdminDashboard.jsx src/pages/LeaderDashboard.jsx
git commit -m "feat: move attendance sessions to functions"
```

---

### Task 12: Managed Volunteers, Walk-Ins, And Claim Flow UI

**Files:**
- Create: `src/pages/admin/ManagedVolunteers.jsx`
- Create: `src/pages/ClaimProfile.jsx`
- Modify: `src/App.jsx`
- Modify: `src/pages/AdminDashboard.jsx`
- Modify: `src/pages/LeaderDashboard.jsx`

- [ ] **Step 1: Create managed volunteers admin component**

Create `src/pages/admin/ManagedVolunteers.jsx`:

```jsx
import { useState } from 'react'
import { api } from '../../lib/callables'
import { useToast } from '../../contexts/ToastContext'

export default function ManagedVolunteers({ onCreated }) {
  const toast = useToast()
  const [form, setForm] = useState({ displayName: '', email: '', phone: '' })
  const [busy, setBusy] = useState(false)
  const [claimCode, setClaimCode] = useState(null)

  async function createVolunteer(event) {
    event.preventDefault()
    setBusy(true)
    setClaimCode(null)
    try {
      const result = await api.createManagedVolunteerProfile(form)
      toast.success('Managed volunteer created')
      setForm({ displayName: '', email: '', phone: '' })
      onCreated?.(result.userId)
    } catch (err) {
      toast.error(err.message || 'Could not create volunteer')
    } finally {
      setBusy(false)
    }
  }

  async function createClaim(userId) {
    setBusy(true)
    try {
      const result = await api.createProfileClaimCode({ managedUserId: userId })
      setClaimCode(result.code)
      toast.success('Claim code created')
    } catch (err) {
      toast.error(err.message || 'Could not create claim code')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Managed Volunteers</h2>
        <p className="text-sm text-gray-500">Create accountless profiles for walk-ins or volunteers without login accounts.</p>
      </div>
      <form className="grid gap-3 sm:grid-cols-3" onSubmit={createVolunteer}>
        <input className="input" required placeholder="Full name" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} />
        <input className="input" type="email" placeholder="Email optional" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <input className="input" type="tel" placeholder="Phone optional" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        <button className="btn-primary sm:col-span-3" disabled={busy}>{busy ? 'Saving...' : 'Create Managed Volunteer'}</button>
      </form>
      {claimCode && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
          Claim code: <span className="font-mono font-semibold">{claimCode}</span>
        </div>
      )}
      <button type="button" className="btn-secondary" disabled={busy} onClick={() => createClaim(window.prompt('Managed volunteer id'))}>
        Create Claim Code By User ID
      </button>
    </section>
  )
}
```

- [ ] **Step 2: Create claim page**

Create `src/pages/ClaimProfile.jsx`:

```jsx
import { useState } from 'react'
import Notice from '../components/Notice'
import { api } from '../lib/callables'
import { useAuth } from '../contexts/AuthContext'

export default function ClaimProfile() {
  const { refreshProfile } = useAuth()
  const [code, setCode] = useState('')
  const [message, setMessage] = useState(null)
  const [busy, setBusy] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setMessage(null)
    try {
      await api.claimManagedVolunteerProfile({ code })
      await refreshProfile()
      setMessage({ type: 'success', text: 'Profile claimed. Your service history is now linked to this account.' })
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Claim failed.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="text-2xl font-bold">Claim Volunteer Profile</h1>
      {message && <Notice type={message.type}>{message.text}</Notice>}
      <form className="card space-y-4" onSubmit={submit}>
        <div>
          <label className="label">Claim Code</label>
          <input className="input font-mono" required value={code} onChange={(e) => setCode(e.target.value)} />
        </div>
        <button className="btn-primary w-full" disabled={busy}>{busy ? 'Claiming...' : 'Claim Profile'}</button>
      </form>
    </div>
  )
}
```

- [ ] **Step 3: Add route**

Add to `src/App.jsx` inside protected layout:

```jsx
<Route path="/claim-profile" element={<ClaimProfile />} />
```

- [ ] **Step 4: Render managed volunteer component**

Render `ManagedVolunteers` in the `AdminDashboard` Users tab, immediately above the existing users table:

```jsx
import ManagedVolunteers from './admin/ManagedVolunteers'
```

```jsx
<ManagedVolunteers onCreated={loadData} />
```

Add a claim-profile link to `Navbar` for all signed-in users:

```jsx
navLinks.push({ to: '/claim-profile', label: 'Claim Profile', icon: User })
```

- [ ] **Step 5: Verify**

Run:

```powershell
npm.cmd run lint
npm.cmd run build
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```powershell
git add src/pages/admin/ManagedVolunteers.jsx src/pages/ClaimProfile.jsx src/App.jsx src/pages/AdminDashboard.jsx src/pages/LeaderDashboard.jsx
git commit -m "feat: add managed volunteer claim flow UI"
```

---

### Task 13: Seed And Reset Scripts

**Files:**
- Create: `scripts/firebase-admin-app.mjs`
- Create: `scripts/seed-launch-data.mjs`
- Create: `scripts/reset-launch-data.mjs`

- [ ] **Step 1: Create script admin helper**

Create `scripts/firebase-admin-app.mjs`:

```js
import { initializeApp, cert, applicationDefault, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

export function initAdminApp() {
  if (getApps().length === 0) {
    if (process.env.SERVICE_ACCOUNT_KEY) {
      initializeApp({ credential: cert(JSON.parse(process.env.SERVICE_ACCOUNT_KEY)) })
    } else {
      initializeApp({ credential: applicationDefault() })
    }
  }
  return { db: getFirestore() }
}
```

- [ ] **Step 2: Create seed script**

Create `scripts/seed-launch-data.mjs`:

```js
import { FieldValue } from 'firebase-admin/firestore'
import { initAdminApp } from './firebase-admin-app.mjs'

const { db } = initAdminApp()

const ministries = [
  { id: 'setup', name: 'Set-Up', displayOrder: 10 },
  { id: 'activities', name: 'Activities', displayOrder: 20 },
  { id: 'kitchen', name: 'Kitchen', displayOrder: 30 },
  { id: 'kids_ministry', name: 'Kids Ministry', displayOrder: 40 },
  { id: 'youth_student', name: 'Youth Student Ministry', displayOrder: 50 },
]

for (const ministry of ministries) {
  await db.collection('ministries').doc(ministry.id).set({
    ...ministry,
    description: '',
    active: true,
    leaderIds: [],
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    createdBy: 'seed-script',
    updatedBy: 'seed-script',
  }, { merge: true })
  console.log(`Seeded ministry ${ministry.id}`)
}

console.log('Launch seed complete.')
```

- [ ] **Step 3: Create guarded reset script**

Create `scripts/reset-launch-data.mjs`:

```js
import { initAdminApp } from './firebase-admin-app.mjs'

if (process.env.CONFIRM_RESET !== 'RESET_VOLUNTEERHUB') {
  console.error('Refusing to reset. Set CONFIRM_RESET=RESET_VOLUNTEERHUB to continue.')
  process.exit(1)
}

const { db } = initAdminApp()
const collections = ['auditLogs', 'attendanceLogs', 'serviceHours', 'eventSignups', 'events', 'claimCodes', 'ministries']

async function deleteCollection(name) {
  const snap = await db.collection(name).get()
  const batch = db.batch()
  snap.docs.forEach((doc) => batch.delete(doc.ref))
  if (!snap.empty) await batch.commit()
  console.log(`Deleted ${snap.size} docs from ${name}`)
}

for (const name of collections) {
  await deleteCollection(name)
}

console.log('Launch data reset complete. User profiles were not deleted.')
```

- [ ] **Step 4: Verify dry guard**

Run:

```powershell
node scripts/reset-launch-data.mjs
```

Expected: exits with "Refusing to reset."

- [ ] **Step 5: Commit**

Run:

```powershell
git add scripts/firebase-admin-app.mjs scripts/seed-launch-data.mjs scripts/reset-launch-data.mjs
git commit -m "chore: add clean launch seed and reset scripts"
```

---

### Task 14: Playwright Critical Smoke Tests

**Files:**
- Create: `tests/e2e/auth-approval.spec.js`
- Create: `tests/e2e/attendance.spec.js`

- [ ] **Step 1: Create auth approval smoke test skeleton**

Create `tests/e2e/auth-approval.spec.js`:

```js
import { expect, test } from '@playwright/test'

test('login page renders and exposes registration', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible()
  await expect(page.getByRole('link', { name: /sign up/i })).toBeVisible()
})

test('register page describes approval flow', async ({ page }) => {
  await page.goto('/register')
  await expect(page.getByRole('heading', { name: /join volunteerhub/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /create account/i })).toBeVisible()
})
```

- [ ] **Step 2: Create attendance smoke test skeleton**

Create `tests/e2e/attendance.spec.js`:

```js
import { expect, test } from '@playwright/test'

test('unauthenticated users are redirected from dashboard', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/login/)
})
```

- [ ] **Step 3: Run e2e tests**

Run:

```powershell
npx.cmd playwright install chromium
npm.cmd run test:e2e
```

Expected: tests pass against local dev server.

- [ ] **Step 4: Commit**

Run:

```powershell
git add tests/e2e playwright.config.js
git commit -m "test: add Playwright production smoke checks"
```

---

### Task 15: Production Runbook

**Files:**
- Create: `docs/production-runbook.md`

- [ ] **Step 1: Write runbook**

Create `docs/production-runbook.md`:

```md
# VolunteerHub Production Runbook

## Required Tools

- Node.js 20 or newer
- Firebase CLI authenticated to the production Firebase project
- Vercel project linked to this repository
- Service account JSON only for local admin scripts, stored outside the repo

## Environment

Frontend environment variables:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_USE_FIREBASE_EMULATORS=false`

## First Launch Order

1. Configure Firebase Auth providers: email/password and Google.
2. Install dependencies: `npm.cmd install` and `npm.cmd install --prefix functions`.
3. Run verification:
   - `npm.cmd run lint`
   - `npm.cmd run test`
   - `npm.cmd run test:rules`
   - `npm.cmd --prefix functions test`
   - `npm.cmd run build`
4. Deploy Firebase:
   - `npm.cmd run deploy:firebase`
5. Deploy frontend through Vercel.
6. Sign in once with the first admin email.
7. Promote first admin:
   - `$env:ADMIN_EMAIL="admin@example.com"`
   - `$env:SERVICE_ACCOUNT_KEY = Get-Content C:\path\to\serviceAccount.json -Raw`
   - `npm.cmd run promote:admin`
8. Seed ministries:
   - `npm.cmd run seed:launch`
9. Run production smoke checks:
   - Register a new test user.
   - Confirm they land pending.
   - Approve them as admin.
   - Confirm event signup unlocks.
   - Create a managed volunteer.
   - Create a claim code.
   - Claim the profile with a signed-in account.
   - Create an event and check a volunteer in/out.

## Reset Launch Data

The reset script does not delete user profiles.

```powershell
$env:CONFIRM_RESET="RESET_VOLUNTEERHUB"
$env:SERVICE_ACCOUNT_KEY = Get-Content C:\path\to\serviceAccount.json -Raw
node scripts/reset-launch-data.mjs
```

## Rollback

- Frontend: roll back to the previous Vercel deployment.
- Firebase rules/functions: redeploy from the previous git commit.
- Data: reset only if explicitly intended. Do not run reset scripts during active events.
```

- [ ] **Step 2: Commit**

Run:

```powershell
git add docs/production-runbook.md
git commit -m "docs: add production runbook"
```

---

### Task 16: Final Verification

**Files:** none expected unless fixes are needed.

- [ ] **Step 1: Run full local verification**

Run:

```powershell
npm.cmd run lint
npm.cmd run test
npm.cmd run test:rules
npm.cmd --prefix functions test
npm.cmd run build
```

Expected: all pass.

- [ ] **Step 2: Run Playwright smoke checks**

Run:

```powershell
npm.cmd run test:e2e
```

Expected: all pass.

- [ ] **Step 3: Inspect git diff**

Run:

```powershell
git status --short
git log --oneline -20
git diff --stat main
```

Expected: working tree clean except intentionally ignored local files. Recent commits show each task.

- [ ] **Step 4: Write final implementation summary**

Create or update `docs/production-readiness-summary.md`:

```md
# Production Readiness Summary

## Implemented

- Firebase Cloud Functions for privileged operations.
- Deny-by-default Firestore rules.
- Admin-only approval and role management.
- Approval-aware auth and route gating.
- Admin approval UI.
- Function-backed event signup and attendance.
- Managed volunteer and claim-code flow.
- Launch seed/reset scripts.
- Unit, rules, functions, and Playwright smoke tests.
- Production runbook.

## Verification

- `npm.cmd run lint`
- `npm.cmd run test`
- `npm.cmd run test:rules`
- `npm.cmd --prefix functions test`
- `npm.cmd run build`
- `npm.cmd run test:e2e`
```

- [ ] **Step 5: Commit final summary**

Run:

```powershell
git add docs/production-readiness-summary.md
git commit -m "docs: summarize production readiness work"
```

---

## Execution Notes

- Do not deploy Firebase rules/functions or Vercel production automatically during implementation. Deployment happens only when the user explicitly requests it after local verification.
- Do not run `scripts/reset-launch-data.mjs` against production without explicit user approval in that turn.
- If a Firebase CLI command fails from missing login/project context, record the failure and continue with local build/test work.
- If emulator tests fail because Java/Firebase CLI is missing, install prerequisites only with user approval.
