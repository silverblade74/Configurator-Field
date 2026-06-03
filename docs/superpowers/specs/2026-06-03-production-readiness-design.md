# Production Readiness Rebuild Design

**Date:** 2026-06-03  
**Scope:** `Configurator-Field` / VolunteerHub production launch readiness  
**Target:** production deployment ready, clean launch with resettable data  
**Recommended approach:** Firebase-first production rebuild with Firebase Cloud Functions

## Purpose

Bring the current VolunteerHub app from a prototype/field-test state to a production-ready church volunteer management system. The app should keep the current Firebase foundation, but stop trusting the browser for sensitive operations. It must support open registration with admin approval, strict attendance control, accountless volunteers and walk-ins, claim-code conversion into real login accounts, scoped ministry-leader operations, automated verification, and clear deployment/runbook documentation.

This is a clean launch. Existing Firebase data does not need a legacy-preserving migration path, though reset and seed scripts must be explicit and safe.

## Current-State Findings

- The app is a React 18 + Vite + Tailwind frontend using Firebase Auth and Firestore.
- The current Firestore rules allow risky client writes, including broad self-updates and authenticated attendance/hour creation.
- Admin and leader workflows exist, but sensitive business logic currently lives mostly in client code.
- Recent repo docs describe approval gating and Wave 1 field-test fixes, but those plans are not implemented in active source.
- The current `AdminDashboard.jsx` is too large and mixes several workflows.
- User feedback still relies on `alert()` and `confirm()` in several critical flows.
- The project has no strong test suite or CI-ready verification path.

## Design Decision

Use a Firebase-first production rebuild:

- Vercel deploys the React/Vite frontend.
- Firebase Auth handles email/password and Google sign-in.
- Firestore stores application data.
- Firebase Cloud Functions, using the Firebase Admin SDK, own privileged mutations.
- Firestore rules become restrictive and deny risky direct client writes.
- Firebase Emulator Suite supports local development and automated tests.

Rejected alternatives:

- **Client-only Firebase hardening:** lower infrastructure, but too much sensitive business logic remains in browser code and Firestore rules become overly complex.
- **Full backend replacement:** stronger long-term control, but too large for the current codebase and unnecessary for the near-term production launch.

## Architecture

The browser is a read-and-request client, not a trusted writer for sensitive operations.

Frontend responsibilities:

- Render role-aware pages and navigation.
- Read allowed Firestore data.
- Call Cloud Functions for privileged writes.
- Show robust validation, loading, success, error, and empty states.

Cloud Function responsibilities:

- Approve/reject users.
- Maintain role custom claims.
- Change roles.
- Create/update/delete ministries and events where privileged.
- Create managed volunteers and walk-ins.
- Generate and validate claim codes.
- Claim accountless profiles into real Auth-linked profiles.
- Write attendance sessions, attendance logs, service-hour rows, user totals, points, badges, and audit logs.
- Enforce server-side business invariants.

Firestore rule responsibilities:

- Deny by default.
- Permit safe client reads and narrowly scoped safe profile updates.
- Block client writes to roles, approval state, totals, points, badges, attendance logs, service hours, claim codes, and signup attendance state.
- Enforce that pending users cannot create signups.
- Enforce leader read scopes where practical; Cloud Functions enforce mutation scopes.

## Roles

Roles:

- `pending`: signed-up user awaiting admin approval.
- `volunteer`: approved user who can view events, sign up, view own service history, and edit safe profile fields.
- `ministry_leader`: can view assigned ministries/departments, rosters, signups, and perform attendance only for assigned events.
- `admin`: full operational control.

Admin-only controls:

- User approval/rejection.
- Role changes.
- Global ministry/event management.
- Claim-code creation.
- Managed volunteer lifecycle.
- Reset/seed operations.
- Production settings.

Leader controls:

- View assigned ministry/department rosters and events.
- Run check-in/check-out/release/no-show for assigned events.
- Add accountless walk-ins for assigned events if the function validates scope.
- No approvals, role changes, global settings, or global deletes.

Volunteer controls:

- Register and sign in.
- Browse allowed ministry/event data.
- Sign up for events only after approval.
- View own service history, points, badges, and profile.
- Edit safe profile fields only.
- Never self-enter or self-edit hours.

## Authentication And Approval

Supported sign-in methods:

- Email/password.
- Google.

Registration:

- Self-registration is open to anyone.
- A newly registered real user starts as `pending`.
- Pending users land on a pending approval page.
- Pending users can browse limited ministries/events, but cannot sign up or accrue service hours.
- Only admins can approve or reject users.

Approval:

- Admin approval changes the user role to `volunteer` unless a different role is explicitly set by an admin later.
- Approval updates Firestore user profile fields and Auth custom claims.
- Rejection stores an optional admin note and leaves the user blocked from volunteer workflows.

First admin setup:

- A setup script promotes a known email address to `admin` after that person signs in once.
- The email is supplied through environment or CLI input and is not committed to source control.
- The script updates Firestore and custom claims.

## Data Model

### `users/{userId}`

Stores both real Auth-linked users and accountless managed profiles.

Important fields:

- `uid`: Auth UID for real users, `null` for unclaimed managed profiles.
- `email`, `displayName`, `phone`, `photoURL`.
- `role`: `pending`, `volunteer`, `ministry_leader`, or `admin`.
- `approvalStatus`: `pending`, `approved`, or `rejected`.
- `approvalNote`, `approvedBy`, `approvedAt`.
- `managed`: boolean.
- `claimed`: boolean.
- `claimedBy`, `claimedAt`.
- `assignedMinistryIds`: array.
- `totalHours`, `totalPoints`, `badges`, `streak`, `lastServedDate`.
- `createdAt`, `updatedAt`, `createdBy`, `updatedBy`.

### `ministries/{ministryId}`

Admin-managed ministry/department records.

Fields:

- `name`, `description`.
- `active`.
- `displayOrder`.
- `leaderIds`.
- `createdAt`, `updatedAt`, `createdBy`, `updatedBy`.

Admins manage these records. Seed data can create the launch defaults.

### `events/{eventId}`

Fields:

- `title`, `description`, `date`, `endDate`.
- `location`.
- `ministryId`.
- `maxVolunteers`.
- `durationHours`.
- `status`: `draft`, `active`, `cancelled`, or `completed`.
- `createdAt`, `updatedAt`, `createdBy`, `updatedBy`.

### `eventSignups/{signupId}`

Fields:

- `eventId`, `userId`.
- `userNameSnapshot`.
- `status`: `signed_up`, `checked_in`, `checked_out`, `released`, `no_show`, or `cancelled`.
- `source`: `self`, `admin`, or `walk_in`.
- `ministryId` / `departmentId`.
- `sessions`: chronological session entries.
- `hoursLogged`: summary total.
- `createdAt`, `updatedAt`, `createdBy`, `updatedBy`.

### Attendance Session Entry

Each session entry contains:

- `checkInAt`.
- `checkInBy`.
- `checkOutAt`.
- `checkOutBy`.
- `hoursLogged`.
- `ministryId` / `departmentId`.
- `releaseReason` when relevant.

Multiple sessions per event signup are supported and summed.

### `attendanceLogs/{logId}`

Immutable session-level records written by functions.

Fields:

- `eventId`, `signupId`, `userId`.
- `checkInAt`, `checkOutAt`.
- `hoursLogged`.
- `ministryId` / `departmentId`.
- `actorIds`.
- `createdAt`.

### `serviceHours/{hourId}`

Normalized reporting rows written by functions.

Fields:

- `userId`, `eventId`, `signupId`, `attendanceLogId`.
- `hours`, `points`.
- `date`.
- `ministryId` / `departmentId`.
- `createdAt`.

### `claimCodes/{claimCodeId}`

One-time claim records for accountless profile conversion.

Fields:

- `managedUserId`.
- `codeHash`.
- `expiresAt`.
- `usedAt`, `usedBy`.
- `createdAt`, `createdBy`.
- `revokedAt`, `revokedBy`.

Raw claim codes are never stored in plaintext.

### `auditLogs/{auditLogId}`

Append-only operational audit records.

Fields:

- `actorId`.
- `actorRole`.
- `action`.
- `targetType`, `targetId`.
- `eventId` / `userId` / `ministryId` where relevant.
- `createdAt`.
- `metadata`.

## Workflows

### Registration And Approval

1. User registers with email/password or Google.
2. App calls a Cloud Function to create the pending profile for the authenticated user.
3. User lands on pending approval page.
4. Admin sees user in pending approvals.
5. Admin approves or rejects.
6. Function writes approval state, role, audit log, and custom claims.
7. Approved user refreshes token and gains volunteer access.

### Event Signup

1. Approved volunteer opens active events.
2. Volunteer signs up for an available event.
3. Cloud Function validates approval status, event status, capacity, duplicate signup state, and creates a signup with status `signed_up`.
4. Pending users see signup disabled and cannot create signups by bypassing UI.
5. Capacity and duplicate-signup rules are enforced server-side.

### Managed Volunteers And Walk-Ins

1. Admin or scoped leader creates an accountless managed profile or walk-in.
2. The profile stores `managed: true`, `claimed: false`, and `uid: null`.
3. The person can be assigned to events and receive attendance hours.
4. Admin generates a one-time claim code/link.
5. Person signs in with email/password or Google.
6. Person submits claim code.
7. Function validates hash, expiration, and unused state.
8. Function links Auth UID to the existing managed profile and preserves hours/history.

### Attendance

1. Admin or scoped leader opens an event attendance screen.
2. Function verifies actor scope.
3. Check-in opens a new session if no session is currently open.
4. Check-out closes the current open session and computes or accepts admin-entered hours.
5. Release and no-show are explicit states.
6. Function writes signup session state, attendance log, service-hour row, user totals, points, badges, and audit log.
7. Volunteers never directly write attendance or hours.

## Frontend Design

Primary route groups:

- Public/auth: login, register, pending approval.
- Volunteer: dashboard, events, ministries, badges, leaderboard, profile.
- Leader: scoped roster, event attendance, assigned ministry activity.
- Admin: approvals, users, managed volunteers, claim codes, ministries, events, attendance, reports, settings.

UI changes:

- Replace `alert()` and `confirm()` flows with inline notices, dialogs, and toasts.
- Add consistent loading, error, empty, and success states.
- Make navigation role-aware.
- Keep admin and leader screens operational and dense.
- Add explicit form validation and clear error copy.
- Confirm destructive operations with accessible dialogs.

Code structure:

- Split `AdminDashboard.jsx` into smaller domain components.
- Add shared service wrappers for Cloud Function calls.
- Keep direct Firestore reads where safe and useful.
- Add providers for auth state, notifications, and shared caches.
- Keep utility functions pure and tested where possible.

## Testing

Add automated verification:

- Unit tests for pure utilities, role helpers, validation helpers, and session calculations.
- Firebase emulator tests for Firestore rules.
- Firebase emulator tests for Cloud Functions.
- Playwright smoke tests for critical flows.

Critical smoke flows:

- Register and land pending.
- Pending user is blocked from event signup.
- Admin approves user.
- Approved volunteer signs up for event.
- Leader can manage assigned event attendance.
- Leader cannot manage unassigned event attendance.
- Admin can create managed volunteer.
- Admin can create claim code.
- Real user can claim managed profile and preserve history.
- Unauthorized users are blocked from protected routes and sensitive functions.

## Tooling And CI

Add scripts:

- `npm run build`
- `npm run lint`
- `npm run test`
- `npm run test:rules`
- `npm run test:functions`
- `npm run test:e2e`
- `npm run emulator`

Add CI-ready checks:

- Install dependencies from a lockfile.
- Run lint, unit tests, emulator tests, and build.
- Run Playwright smoke tests where environment permits.

## Deployment

Frontend:

- Vercel deploys the React/Vite app.
- `.env.example` documents all required `VITE_FIREBASE_*` values.

Firebase:

- Deploy Firestore rules.
- Deploy Firestore indexes.
- Deploy Cloud Functions.
- Configure Auth providers for email/password and Google.
- Configure emulator suite for local work.

Clean-launch scripts:

- Promote first admin by email after sign-in.
- Seed ministries/departments.
- Seed optional launch events.
- Reset launch data only through an explicit, guarded command.

Rollout order:

1. Configure Firebase project and Auth providers.
2. Deploy Firestore indexes, rules, and Cloud Functions.
3. Deploy Vercel frontend.
4. Sign in first admin.
5. Run admin promotion script.
6. Seed ministries and launch data.
7. Run production smoke checklist.

## Acceptance Criteria

- Pending users cannot sign up for events through UI, direct Firestore writes, or function calls.
- Only admins can approve users and change roles.
- Leaders can perform attendance only for assigned events.
- Volunteers cannot write attendance, service hours, points, badges, roles, or approval fields.
- Managed volunteers and walk-ins can accrue history before login.
- Claim-code flow links a real Auth account to an existing managed profile without losing history.
- Event attendance supports multiple sessions per event signup.
- Critical writes produce audit logs.
- Frontend build, lint, unit tests, emulator tests, and core Playwright smoke tests pass.
- Deployment/runbook documentation exists and is specific enough to operate from.

## Out Of Scope For This Production-Readiness Pass

- Replacing Firebase with another database/backend.
- Adding payments, email marketing, SMS, or advanced communications.
- Multi-tenant support for multiple churches.
- Public marketing pages.
- Historical production-data preservation.

## Risks

- Introducing Cloud Functions changes the local and deployment workflow.
- Custom claims require token refresh after role changes.
- Clean-launch reset scripts are powerful and must be guarded.
- Firestore rule tests are required because accidental over-permissioning is the main production risk.
- The current admin UI is large; refactoring it should be phased to avoid mixing too many behavioral changes at once.

## Implementation Sequence

The implementation plan should be phased:

1. Tooling baseline and lockfile.
2. Firebase emulator and test harness.
3. Cloud Functions scaffold and Admin SDK setup.
4. Strong Firestore rules and rule tests.
5. Auth/approval/custom-claims workflow.
6. Data model normalization and clean-launch seed scripts.
7. Admin UI split and approval/users workflows.
8. Ministries/events management.
9. Attendance functions and leader/admin attendance UI.
10. Managed volunteer, walk-in, and claim-code flow.
11. Reporting/gamification consistency.
12. Playwright smoke tests.
13. Deployment runbook and production smoke checklist.
