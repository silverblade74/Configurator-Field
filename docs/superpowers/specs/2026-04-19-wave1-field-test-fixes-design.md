# Volunteer App Wave 1 — Field-Test Fixes — Design Spec

**Date:** 2026-04-19
**Scope:** live repo (root) on `main` branch at `silverblade74/Configurator-Field`
**Status:** approved for implementation planning
**Predecessor:** `2026-04-17-approval-gated-main-design.md` (approval-gated registration — already shipped)

## Purpose

Fix six field-test gaps reported after the 2026-04-19 live run of the Church Volunteer App. These are the "bugs and data-integrity fixes" wave of a three-wave follow-up plan. Wave 2 covers dashboard surfacing and ministry content. Wave 3 covers IA cleanup plus a feedback + notes subsystem.

## Decisions

- **Save feedback:** every admin mutation persists on click/blur (no change from today) but the UI now shows a toast, spinner, and inline error state so the operator knows the write landed.
- **Strangers-as-walk-ins:** a new inline path creates a managed volunteer (name required, email + phone optional) and starts a first session in one action.
- **Multi-session check-in/out:** `eventSignups.sessions[]` — an array of `{ checkInAt, checkOutAt, hoursLogged, department }` objects. Parent fields (`status`, `hoursLogged`, `checkedInAt`, `checkedOutAt`) stay in sync for back-compat with existing reads (leaderboard, dashboards, legacy clients).
- **Managed-volunteer email:** add missing Email and Phone inputs to the create form. The `createManagedVolunteer` service already accepts both.
- **Ministry dropdowns:** back them with a shared `useMinistries()` hook so mutations on one tab update dropdowns on every other tab in the same session without page reload.
- **Volunteer search:** client-side filter on the already-loaded Check-In signup list and on the walk-in picker; matches substring against `displayName` and `email`, case-insensitive.

## Data Model

### `eventSignups` — changed

New field:

| Field | Type | Notes |
|-------|------|-------|
| `sessions` | `Array<Session>` | Chronological. Empty for `signed_up`. One entry per check-in/check-out pair. |

```js
// Session shape
{
  checkInAt: Timestamp,
  checkOutAt: Timestamp | null,   // null while the session is open
  hoursLogged: number,            // 0 while open; set on close
  department: string | null,      // department this session was served under
}
```

Parent fields kept in sync (write-path, not reads — readers of the array stay authoritative):

- `status` — `'signed_up'` (sessions empty) · `'checked_in'` (last session open) · `'checked_out'` (all closed) · `'released'` · `'no_show'`
- `hoursLogged` — sum of `sessions[].hoursLogged`
- `checkedInAt` — `sessions[0].checkInAt` once at least one session exists
- `checkedOutAt` — `sessions[last].checkOutAt` when status is `checked_out`, else `null`
- `department` — mirrors the latest session's department

Existing fields (`eventId`, `userId`, `userName`, `createdAt`) unchanged.

### `users` — unchanged

`createManagedVolunteer` already writes `email` and `phone`. Only UI inputs are added.

### `attendanceLogs`, `serviceHours` — unchanged

Still one row per completed session, same shape as today. The row now represents a session rather than a whole signup; downstream aggregations (`users.totalHours`, `users.totalPoints`, leaderboard) are unaffected because they already sum per-log entries.

### Firestore rules

No changes. The current `/eventSignups/{id}` update rule is field-agnostic (`allow update: if isAuth() && (resource.data.userId == request.auth.uid || isLeaderOrAdmin())`), so admins and ministry leaders can already write `sessions` under the existing rule.

## Migration

One-time script `scripts/backfill-sessions.mjs` — Firebase Admin SDK, run locally against prod with `SERVICE_ACCOUNT_KEY` env var.

```js
// For each /eventSignups doc missing `sessions`:
//   if checkedInAt exists:
//     sessions = [{ checkInAt: checkedInAt,
//                   checkOutAt: checkedOutAt || null,
//                   hoursLogged: hoursLogged || 0,
//                   department: department || null }]
//   else:
//     sessions = []
// Batched writes (400 per commit).
```

Spot-check 3–5 docs in Firestore console after run: a past signup has one synthesized session; a fresh pre-check-in signup has `sessions: []`.

## Service Layer (`src/services/firestore.js`)

### New exports

```js
// Append a session with { checkInAt: serverTimestamp(), checkOutAt: null, hoursLogged: 0, department }.
// Writes status='checked_in', checkedInAt (if first session). Throws if an open session already exists.
export async function startSession(signupId, department = null)

// Close the open session. manualHours overrides clock math when provided.
// Writes one /attendanceLogs row, one /serviceHours row, increments /users/{userId}.totalHours and totalPoints,
// updates /users/{userId}.lastServedDate. Updates parent status, hoursLogged, checkedOutAt on the signup.
// Same side-effect contract as today's checkOut, scoped to the closing session.
export async function endSession(signupId, userId, { manualHours = null } = {})

// Pure helper. Returns the last session if it's open (checkOutAt null), else null.
export function getOpenSession(signup)

// One-shot for the "Walk-in (new person)" flow: creates managed volunteer, then opens first session.
// Returns { userId, signupId }. Name required; email and phone optional (empty string default).
export async function createWalkInVolunteer(eventId, { displayName, email = '', phone = '' })
```

### Modified exports

- `checkIn(signupId)` → thin wrapper calling `startSession(signupId)`. Kept for existing call sites.
- `checkOut(signupId, userId, manualHours)` → thin wrapper calling `endSession(signupId, userId, { manualHours })`. Kept.
- `adminAddVolunteer(eventId, userId, userName)` → on insert, writes `sessions: [{ checkInAt: serverTimestamp(), checkOutAt: null, hoursLogged: 0, department: null }]` alongside the existing `status: 'checked_in'` and `checkedInAt: serverTimestamp()`.
- `signUpForEvent(eventId, userId, userName)` → adds `sessions: []` to the new doc.
- `assignDepartment(signupId, department)` → if an open session exists, sets `department` on that session AND on the parent doc; otherwise parent only. (Matches current UX: the admin is assigning a department for the active service window.)
- `releaseVolunteer`, `markNoShow` → unchanged.

The two wrappers exist so any code path we miss (leader dashboard, internal callers) keeps working through the deploy. They get removed in a follow-up Wave-2 cleanup once we've audited every call site.

## UI

### New component: `Toast.jsx` + `ToastContext`

Single app-level toast surface rendered from `Layout.jsx`. API:

```js
const toast = useToast()
toast.success('Saved')
toast.error('Could not save: …')
toast.info('Synced')
```

Auto-dismiss at 3s for success/info; sticky with a close button for error. Stacks up to 3 concurrent toasts. ~80 lines total including the context provider.

### New hook: `useAsyncAction`

```js
const [run, saving, error] = useAsyncAction()
await run(async () => { await updateUserRole(userId, newRole) })  // toast.success / toast.error handled inside
```

Wraps the save → toast → error pattern so each admin handler shrinks to two or three lines.

### New hook: `useMinistries`

In-memory shared cache + refresh key. Every page that renders ministry dropdowns consumes `useMinistries()`; every mutation call site calls the hook's `refresh()` after the write. Same-session, same-tab stale-dropdown bug goes away. Cross-tab real-time sync is explicitly deferred to Wave 2 (same behavior as today).

### `AdminDashboard.jsx`

**Users tab**
- Managed-volunteer create form: add **Email** input and **Phone** input (both optional). State already exists at `volunteerForm.email` and `volunteerForm.phone` — this is rendering the inputs.
- Every field edit (role change, delete) wrapped in `useAsyncAction`. Spinner on the row during save; toast on resolve.
- Alerts (`alert('Failed to create ministry')`, etc.) replaced with `toast.error`.

**Check-In tab**
- Add a **search box** above the signups list. Filters `eventSignups` by `userName`/`displayName` and `email` substring, case-insensitive.
- The search that already exists on the "add walk-in volunteer" picker (for people already in the system) stays; both searches share one filter helper.
- Add a second action in the walk-in area labeled **"New walk-in"** (or similar). Opens a modal with:
  - Name (required)
  - Email (optional)
  - Phone (optional)
  - On submit → `createWalkInVolunteer(checkInEventId, { displayName, email, phone })` → toast → refresh signups.
- Per-row actions driven by session state:
  - `getOpenSession(signup)` returns null (no sessions OR all closed) → show **"Check In"** button.
  - Open session exists → show **"Check Out"** button plus the manual-hours input (as today).
- Each signup row shows `sessions.length` and running `hoursLogged`.
- Expanding a row shows the session list: each row gets `checkInAt`, `checkOutAt` (or "open"), `hoursLogged`, `department`.
- Bulk check-in and bulk check-out continue to work; bulk check-in only opens a session on signups with no open session; bulk check-out only closes signups with an open session.

**Events tab**
- Every mutation wrapped in `useAsyncAction`; alerts replaced with toasts.
- Assignment-dropdown data comes from `useMinistries()` (same hook as elsewhere).

**Ministries tab**
- `handleCreateMinistry`, `handleDeleteMinistry`, inline edit → wrapped in `useAsyncAction`. After success, call `useMinistries().refresh()`.
- Alerts replaced with toasts.

**Overview tab** — no change.

### `LeaderDashboard.jsx`

- Approve/reject actions wrapped in `useAsyncAction` → toast.
- If the leader dashboard has check-in/out affordances today, they switch to session-aware buttons via `getOpenSession` + `startSession` / `endSession`. Layout unchanged.
- Ministry dropdowns (if present) backed by `useMinistries()`.

### `VolunteerDashboard.jsx`, `Events.jsx`, `Ministries.jsx`, `Profile.jsx`

No changes in Wave 1. Volunteer-facing surfaces stay as today; their Wave 2 / Wave 3 updates are tracked in their own specs.

## Rollout

Strict order:

1. **Ship client code on feature branch → Vercel preview.** New code writes `sessions: []` on new signups and appends a session on check-in. Legacy docs (no `sessions` field) still render because `getOpenSession` falls back to the parent `checkedInAt`/`checkedOutAt` shape when the array is missing.
2. **Smoke test on preview** (checklist below). Bail if anything fails.
3. **Merge to `main`** → Vercel auto-deploys prod. Prod tolerates legacy docs; only new activity writes sessions.
4. **Run `scripts/backfill-sessions.mjs`** against prod. Verify 3–5 docs in the Firebase console: past signup has a one-element session; never-checked-in signup has `sessions: []`.
5. **Post-backfill smoke** on prod: open a past-event Check-In → sessions render; live check-in → appends a new session.

No rules deploy — the current `/eventSignups` update rule is field-agnostic.

## Testing

No automated framework — manual smoke on the Vercel preview before promoting, and one post-backfill pass on prod.

**Preview checklist:**

- [ ] Admin adds a brand-new managed volunteer with email + phone → appears in Users tab with both fields populated.
- [ ] Admin searches Check-In by name and by email (substring) → both filter correctly.
- [ ] Admin clicks "New walk-in" with name only → creates volunteer, opens first session, toast fires, row appears in signups with one open session.
- [ ] Admin checks in an existing volunteer → spinner → toast "Saved" → row shows one open session, `sessions.length = 1`.
- [ ] Admin checks them out → row shows one closed session, `hoursLogged` set, `attendanceLogs` gains one row, `users.totalHours` increments, toast fires.
- [ ] Admin checks the same volunteer back in → second session opens, running total reflects the first session only.
- [ ] Admin checks out again with `manualHours = 1.5` → second session records 1.5h, parent `hoursLogged` equals first + 1.5.
- [ ] Admin creates a ministry → assignment dropdowns on Users tab and Check-In tab reflect it without page reload.
- [ ] Admin deletes a ministry → it disappears from the same dropdowns.
- [ ] Simulated save failure (revoke a field's rule momentarily, or trip required-field validation) → red toast with error text, UI stays on the failed row, no silent loss.
- [ ] Legacy signup (from before Wave 1 deploy) still renders on the Check-In tab — shows one synthesized session after backfill; renders gracefully before backfill via the fallback.
- [ ] Existing approval-gated flow unaffected: pending volunteer still sees disabled "Approval required" on Events; admin approvals still work; rejected user's note still renders.

**Post-backfill prod checklist:**

- [ ] 3–5 spot-checked legacy signups show one session with correct `checkInAt`/`checkOutAt`/`hoursLogged`.
- [ ] One live check-in on a current event appends a fresh session.
- [ ] Leaderboard totals match pre-migration totals (sanity: `SUM(users.totalHours)` unchanged).

## Scope

### In

- `sessions[]` field on `/eventSignups` + parent-field sync writes
- `startSession`, `endSession`, `getOpenSession`, `createWalkInVolunteer` in `firestore.js`
- `checkIn`, `checkOut`, `adminAddVolunteer`, `signUpForEvent`, `assignDepartment` updates to write sessions
- `Toast` component + `ToastContext` + `useToast` + `useAsyncAction` hook
- `useMinistries` shared cache hook; replaces local `ministries` state where dropdowns consume it
- Email and Phone inputs on the managed-volunteer create form
- Volunteer search box on Check-In tab; shared filter helper
- "Walk-in (new person)" modal + flow
- Session-aware per-row buttons + expandable session list on Check-In tab
- `scripts/backfill-sessions.mjs` + one-time run

### Out

- Tab / IA restructuring (Wave 3)
- Ministry descriptions rendered in volunteer-facing Ministries.jsx (Wave 2)
- Ministry "express interest" signal (Wave 2)
- Dashboard surfacing — leaderboard position on VolunteerDashboard, volunteers-by-ministry on LeaderDashboard, volunteers-on-events on AdminDashboard Events tab, per-event hours breakdown (Wave 2)
- Post-event volunteer feedback loop (Wave 3)
- Admin / ministry-leader notes subsystem (Wave 3)
- Cross-tab real-time ministry sync (Wave 2)
- Automated test infrastructure (project policy)
- Removal of the `checkIn` / `checkOut` service wrappers (Wave 2 cleanup)

### Risks

- Backfill races a live event check-out. Mitigation: schedule the script for a window with no active events.
- `useMinistries()` is in-memory only. Two browser tabs held open by one admin show stale data until the non-origin tab refreshes. Acceptable — matches today's behavior; full subscription lands in Wave 2.
- `Toast` and `useMinistries` touch `Layout.jsx`, which every page renders through. Smoke test every route after the change.
- Wrappers around `checkIn` / `checkOut` mean two code paths exist briefly. Internal callers are migrated in the same PR to keep the window short.
