import { initializeApp, cert, applicationDefault } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

const email = process.env.ADMIN_EMAIL
if (!email) {
  console.error('ADMIN_EMAIL is required. Example: $env:ADMIN_EMAIL="admin@example.com"')
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
