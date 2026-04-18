# Approval-Gated Rollout Checklist

Run these steps in order after merging `feature/approval-gated` into `main`.

## 1. Client code deploy (Vercel)

Merging to `main` triggers a Vercel production deploy automatically. Verify on the Vercel dashboard that the new deployment reaches "Ready" state.

Smoke test on a preview URL BEFORE promoting to production if possible:

- Register a test user → lands on `/pending-approval`.
- Admin test account sees the test user in the Overview → Pending Approvals card.
- Approve via admin button → test user's status flips to approved, event signup unlocks.

## 2. Migration

On your local machine, from the repo root:

```powershell
# Obtain a service-account key from Firebase Console
# (Project settings > Service accounts > Generate new private key).
$env:SERVICE_ACCOUNT_KEY = Get-Content serviceAccountKey.json -Raw
node scripts/backfill-approval-status.mjs
```

Expected output: `Updated: N. Skipped: M.` where N is the number of pre-existing users that got backfilled.

Spot-check 3–5 user docs in the Firestore console:

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
- [ ] Open DevTools → Console. No red errors.
- [ ] Events page renders with disabled "Approval required" button for the pending user.
- [ ] Admin dashboard shows the pending user; approving flips their access.
- [ ] A ministry-leader account with at least one ministry in their `ministries` array can see and approve users whose `requestedMinistryIds` overlap that ministry, and CANNOT see users outside their scope.
- [ ] Existing approved users continue to function normally (login, dashboard, signups).
- [ ] Managed-volunteer creation still works; created docs have `approvalStatus: 'approved'`.

## Rollback (if needed)

- Revert the merge commit on `main` and redeploy the previous Vercel build.
- Redeploy the previous Firestore rules (stored in git history before this branch). Example:
  ```powershell
  git checkout <pre-merge-sha> -- firestore.rules
  firebase deploy --only firestore:rules
  ```
- The migration is additive-only — no rollback needed for the Firestore data. New `approvalStatus` fields become dormant when the old client code is restored.
