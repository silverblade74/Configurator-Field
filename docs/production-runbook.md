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
