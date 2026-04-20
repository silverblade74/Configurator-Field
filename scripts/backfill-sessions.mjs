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
