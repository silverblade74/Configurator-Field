# Approval-Gated Volunteer Workflow (port to main) — Design Spec

**Date:** 2026-04-17
**Scope:** live repo (root) on `main` branch at `silverblade74/Configurator-Field`
**Status:** approved for implementation planning

## Purpose

Add approval-gated registration to the live volunteer app so self-registered users cannot sign up for events until an admin (or a ministry leader for their scope) reviews and approves them. Production is currently open — anyone who registers gets immediate event-signup access.

## Decisions

- **Scope:** full approval flow — `pending | approved | rejected` states, admin queue, ministry-leader-scoped approvals, pending landing page, ministry-interest selection during registration, Firestore rule enforcement.
- **Existing users (live production):** admins and ministry leaders auto-approved via a one-time migration; volunteers become pending.
- **Managed volunteers (admin-created placeholder accounts):** auto-approved on creation. Keep main's existing schema otherwise unchanged.
- **Legacy client fallback:** `normalizeApprovalStatus()` in AuthContext infers status from role if the field is missing — belt-and-suspenders for any doc missed by migration.
- **No magic-link / walk-in claim flow**: main's managed-volunteers model doesn't need it.

## Data Model

New fields on `/users` documents:

| Field | Type | Notes |
|-------|------|-------|
| `approvalStatus` | `'pending' \| 'approved' \| 'rejected'` | Empty/missing on pre-migration docs; client treats admin/leader as approved, volunteer as pending. |
| `requestedMinistryIds` | `string[]` | Set during self-registration; ministry leaders use this to filter their approval queue. |
| `approvedBy` | `string \| null` | UID of the reviewer. |
| `approvedAt` | `Timestamp \| null` | |
| `approvalNote` | `string` | Optional rejection note. |

Managed-volunteer create path gains `approvalStatus: 'approved'` (otherwise unchanged).

## AuthContext Changes

- `normalizeApprovalStatus(profile)`: admin/leader → `'approved'`; else → `profile.approvalStatus || 'pending'`.
- `normalizeUserProfile(profile)`: wraps a raw doc — applies `normalizeApprovalStatus`, defaults `requestedMinistryIds` to `[]`.
- Context value exposes `isApproved`, `isPending`, `isRejected` booleans.
- `register(email, password, displayName, requestedMinistryIds = [])`:
  - After `createUserWithEmailAndPassword`, call `result.user.getIdToken(true)` to force token propagation to Firestore.
  - Wrap `updateProfile` + `createUserProfile` in try/catch; on failure delete the Auth account via `result.user.delete()` to prevent orphans, then rethrow.
  - `createUserProfile` writes `approvalStatus: 'pending'`, `requestedMinistryIds`, and `approvedBy: null`, `approvedAt: null`, `approvalNote: ''`.
- `loginWithGoogle()`: same token-refresh + try/catch rollback, but rollback is skipped if a Firestore doc for the user already exists (avoids wiping successful concurrent creates).
- `onAuthStateChanged` listener unchanged in structure; the `createUserProfile` it calls receives no `extraData`.

## Routing & Guards

**ProtectedRoute gains two new props:**

- `requireApproved` (default `false`) — approved-only route. Pending users redirect to `/pending-approval`. Rejected users redirect to `/profile`.
- `allowPending` (default `false`) — explicitly lets pending users through (otherwise any unset guard falls through to default auth-only behavior).

**`App.jsx` route map:**

| Path | Guard |
|------|-------|
| `/login`, `/register` | public |
| `/pending-approval` (new) | `allowPending` |
| `/dashboard`, `/leaderboard`, `/badges` | `requireApproved` |
| `/events`, `/ministries`, `/profile` | authenticated only (pending users allowed, browse-only UX inside) |
| `/leaders` | existing role gate (`ministry_leader` or `admin`) — both auto-approved by migration |
| `/admin` | existing role gate (`admin`) |

**Navbar:** hide approved-only links (`/dashboard`, `/leaderboard`, `/badges`) for pending users; show a prominent "Pending review" link/badge to `/pending-approval` when pending.

## UI Additions

### Register.jsx

- Add a "Ministries you are interested in" checkbox list (optional; name stays the only required field). Loads ministries from Firestore.
- Add an info banner above the form: "After creating your account, an admin or ministry leader will review your request before event signup is enabled."
- Redirect on successful registration → `/pending-approval`.
- Google sign-in button → also navigates to `/pending-approval` (route guard would redirect there anyway for first-time users; explicit nav avoids the confusing two-hop chain).

### PendingApproval.jsx (new)

- Welcome card: "Thanks for registering, {displayName}!"
- Status banner via `Notice` component (info for pending; error for rejected, showing `approvalNote`).
- Links to `/events` and `/ministries` (browse-only).
- Sign-out button.
- Reads only `userProfile` from context; no Firestore queries.

### Notice.jsx (new component)

- Reusable inline banner: `<Notice type="info|success|warning|error" title={...}>children</Notice>`.
- Used in Register, PendingApproval, Profile, AdminDashboard, LeaderDashboard, Events.
- Separate purpose from `EmptyState` (empty-list placeholder) — both components kept.

### AdminDashboard.jsx

- **Overview tab:** new "Pending Approvals" card at the top (before Top Volunteers):
  - Header: "Pending Approvals" + count badge.
  - Per-row: displayName, email, requested ministries (comma-separated names), Approve + Reject buttons.
  - Reject opens `window.prompt` for optional note.
  - Empty state: "No pending users need review."
  - Admin sees all pending users regardless of ministry.
- **Users tab:** add `Status` column (Pending / Approved / Rejected badge) adjacent to role. Add filter dropdown: All / Pending / Approved / Rejected / Managed volunteers.

### LeaderDashboard.jsx

- New "Pending Approvals for my ministries" section at the top.
- Uses `getPendingUsersForReviewer(leaderProfile)` — returns users whose `requestedMinistryIds` overlap with `leaderProfile.ministries`.
- Same approve/reject UX as admin.

### Events.jsx

- Route stays accessible to pending users.
- When `!isApproved`, replace "Sign Up" button with disabled "Approval required" button.
- Replace existing `alert()` calls with inline `Notice` at top of page.
- Audit `userProfile.uid` vs `userProfile.id` in signup write — switch to `userProfile.id` so managed-volunteer signups use the correct doc key consistently.

### Profile.jsx

- Add status banner (info/error depending on `approvalStatus`) below the title.
- Replace existing `alert('Failed to update profile')` with inline `Notice`.
- Hide any gamification stats grid (if present) when `!isApproved`.

## Firestore Service Helpers

New exports in `src/services/firestore.js`:

```js
export async function getPendingUsersForReviewer(reviewerProfile) {
  const q = query(
    collection(db, 'users'),
    where('approvalStatus', '==', 'pending'),
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

Client-side sort bypasses the composite-index requirement Firestore would impose for `where + orderBy`.

## Firestore Rules

Add the following helpers inside `match /databases/{database}/documents`, after `isAuth()`:

```js
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
```

Replace the `/users/{userId}` match block with:

```js
match /users/{userId} {
  allow read: if isAuth();
  allow create: if isSelf(userId)
    && request.resource.data.role == 'volunteer'
    && request.resource.data.approvalStatus == 'pending';
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
```

`/eventSignups/{signupId}` — change `create`:

```js
allow create: if isApproved();
```

All other rules (ministries, events reads/writes, signup updates/deletes, attendanceLogs, serviceHours) remain exactly as main has them.

Main's `createManagedVolunteer` (confirmed in `src/services/firestore.js:228`) writes a `/users` doc via `addDoc` (auto-generated ID) with `uid: null`, `managed: true`, `role: 'volunteer'`. Because the doc ID is auto-generated, `isSelf(userId)` is false for the admin's own UID, so the self-create rule doesn't cover it. Add a dedicated admin-create clause inside `/users/{userId}`:

```js
allow create: if isAdmin()
  && request.resource.data.managed == true
  && request.resource.data.role == 'volunteer'
  && request.resource.data.approvalStatus == 'approved';
```

Update `createManagedVolunteer` to also write `approvalStatus: 'approved'`, `requestedMinistryIds: []`, `approvedBy: <adminUid>`, `approvedAt: serverTimestamp()`, `approvalNote: ''` (symmetry with self-registered docs so the Pending Approvals query never misfires on them).

## Migration Script

Run once, locally, against the production Firebase project. Uses Firebase Admin SDK with a service-account key.

```js
// scripts/backfill-approval-status.mjs
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

initializeApp({ credential: cert(JSON.parse(process.env.SERVICE_ACCOUNT_KEY)) })
const db = getFirestore()

const snap = await db.collection('users').get()
const batch = db.batch()
let count = 0

for (const doc of snap.docs) {
  const data = doc.data()
  if (data.approvalStatus) continue // already has it
  const status = (data.role === 'admin' || data.role === 'ministry_leader')
    ? 'approved'
    : 'pending'
  batch.update(doc.ref, { approvalStatus: status, updatedAt: new Date() })
  count++
}

if (count > 0) await batch.commit()
console.log(`Backfilled ${count} users.`)
```

Spot-check 3-5 docs in Firestore console after running: admins/leaders have `'approved'`, volunteers have `'pending'`.

## Rollout Sequence (strict order)

1. **Deploy client changes to Vercel production.** New code tolerates docs missing `approvalStatus` via the client-side legacy fallback, so existing users keep working. Admins/leaders see unchanged behavior (normalized to approved). Existing volunteers normalize to pending, which blocks their signup UI — migration in step 2 formalizes this.
2. **Run migration script.** Backfills `approvalStatus` on every existing user doc. Verify in console.
3. **Deploy new Firestore rules.** After step 2, every doc has `approvalStatus`, so rule helpers like `isApproved()` work reliably. Self-registered users created before this step already have `approvalStatus: 'pending'` via the new client code (if step 1 shipped before their registration); post-migration docs are consistent either way.

## Testing

No automated test framework in the project — all verification is manual smoke testing on a Vercel preview deployment before promoting to production.

**Smoke test checklist (on preview):**

- [ ] New test user registers → lands on `/pending-approval`, cannot access `/dashboard`.
- [ ] Events page renders for pending user with disabled "Approval required" button.
- [ ] Admin dashboard Overview shows the test user in Pending Approvals card with their requested ministries.
- [ ] Approve → user's status flips to approved, event signup unlocks on their next page load.
- [ ] Reject with note → note appears on their profile / pending page.
- [ ] Create a ministry-leader test account (role via Firestore console) with one ministry in `ministries: []`. That leader sees only pending users who requested that ministry.
- [ ] Leader attempts to approve a user outside their ministries → UI should not show the Sign up button, and if bypassed via devtools the Firestore rule denies the write.
- [ ] Existing approved/admin users continue to function normally.
- [ ] Managed-volunteer creation still works, created docs are auto-approved.

## Scope

### In
- `approvalStatus`, `requestedMinistryIds`, approval-tracking fields on `/users`
- Client-side legacy fallback via `normalizeApprovalStatus`
- AuthContext rewrite (token refresh + orphan rollback + new register signature)
- `ProtectedRoute` gains `requireApproved` / `allowPending`
- `Notice` component
- `PendingApproval.jsx`
- Ministry-interest checkboxes in Register
- Pending Approvals card in AdminDashboard and LeaderDashboard
- Status column + filter in AdminDashboard Users tab
- Events browse-only for pending users
- Profile status banner
- New Firestore rules (users/update/create + eventSignups create)
- Migration script and one-time run
- Firestore-service helpers: `getPendingUsersForReviewer`, `approveUser`, `rejectUser`

### Out
- Magic-link sign-in / walk-in claim flow (not needed with managed-volunteers model)
- Mojibake audit (no reports of mojibake issues on main)
- Refactoring LeaderDashboard beyond adding the approval section
- Changing managed-volunteers schema beyond writing `approvalStatus: 'approved'`
- Changing main's department / enhanced-check-in / admin-assign-to-event code
- Any automated test infrastructure

### Risks
- Rule changes are deployed to a live project with real users. The migration → rules-deploy order is load-bearing; reversing them breaks writes.
- Client-code deploys on Vercel auto-deploy from `main` — so the work must land on a feature branch, be smoke-tested on preview, then merged.
- Firebase Auth orphan accounts (the bug that prompted this work) — addressed by the new `register()` try/catch + rollback, but worth explicitly verifying during smoke test.
