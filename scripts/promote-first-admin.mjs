import { createRequire } from 'module'
import { initializeApp, cert, applicationDefault } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import {
  buildAdminAppOptions,
  createFirebaseCliCredential,
  getAdminCredentialSetupMessage,
  isMissingAdminCredentialError,
  resolveFirebaseProjectId,
} from './firebase-admin-config.mjs'
import { patchFirestoreDocument } from './firestore-rest.mjs'

const require = createRequire(import.meta.url)
const email = process.env.ADMIN_EMAIL
if (!email) {
  console.error('ADMIN_EMAIL is required. Example: $env:ADMIN_EMAIL="admin@example.com"')
  process.exit(1)
}

const projectId = resolveFirebaseProjectId()
if (!projectId) {
  console.error('FIREBASE_PROJECT_ID is required when the active credentials do not provide a default project.')
  console.error('Example: $env:FIREBASE_PROJECT_ID="your-project-id"; $env:ADMIN_EMAIL="admin@example.com"; npm.cmd run promote:admin')
  process.exit(1)
}

const firebaseCliCredential = process.env.SERVICE_ACCOUNT_KEY
  ? null
  : createFirebaseCliCredential({ requireFn: require })

const credential = process.env.SERVICE_ACCOUNT_KEY
  ? cert(JSON.parse(process.env.SERVICE_ACCOUNT_KEY))
  : firebaseCliCredential?.credential || applicationDefault()

function buildAdminProfile(user, timestampValue) {
  return {
    uid: user.uid,
    email: user.email || email,
    displayName: user.displayName || email,
    phone: '',
    photoURL: user.photoURL || '',
    role: 'admin',
    approvalStatus: 'approved',
    approvalNote: '',
    approvedBy: 'setup-script',
    approvedAt: timestampValue,
    managed: false,
    claimed: true,
    claimedBy: user.uid,
    claimedAt: timestampValue,
    assignedMinistryIds: [],
    totalHours: 0,
    totalPoints: 0,
    badges: [],
    streak: 0,
    lastServedDate: null,
    createdAt: timestampValue,
    updatedAt: timestampValue,
    createdBy: 'setup-script',
    updatedBy: 'setup-script',
  }
}

async function writeAdminProfile(user) {
  if (firebaseCliCredential) {
    const token = await credential.getAccessToken()
    await patchFirestoreDocument({
      projectId,
      collection: 'users',
      documentId: user.uid,
      data: buildAdminProfile(user, new Date()),
      accessToken: token.access_token,
    })
    return
  }

  const db = getFirestore()
  await db.collection('users').doc(user.uid).set(
    buildAdminProfile(user, FieldValue.serverTimestamp()),
    { merge: true },
  )
}

async function main() {
  initializeApp(buildAdminAppOptions({ credential }))

  const auth = getAuth()
  const user = await auth.getUserByEmail(email)
  await writeAdminProfile(user)

  await auth.setCustomUserClaims(user.uid, { role: 'admin' })
  console.log(`Promoted ${email} (${user.uid}) to admin.`)
}

try {
  await main()
} catch (error) {
  if (isMissingAdminCredentialError(error)) {
    console.error(getAdminCredentialSetupMessage({ projectId, email }))
    process.exit(1)
  }
  throw error
}
