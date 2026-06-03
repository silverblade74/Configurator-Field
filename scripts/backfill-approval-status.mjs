// scripts/backfill-approval-status.mjs
//
// One-time migration: write approvalStatus on every /users doc that lacks it.
// - admin / ministry_leader roles -> 'approved'
// - any other role -> 'pending'
//
// Usage:
//   1. Generate a service account key in Firebase Console
//      (Project settings > Service accounts > Generate new private key).
//   2. Save the JSON content to an env var, e.g.:
//      $env:SERVICE_ACCOUNT_KEY = Get-Content serviceAccountKey.json -Raw
//   3. Run: node scripts/backfill-approval-status.mjs
//
// The script is idempotent: re-running skips docs that already have approvalStatus.

import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'

if (!process.env.SERVICE_ACCOUNT_KEY) {
  console.error('SERVICE_ACCOUNT_KEY env var is required.')
  process.exit(1)
}

initializeApp({ credential: cert(JSON.parse(process.env.SERVICE_ACCOUNT_KEY)) })
const db = getFirestore()

async function main() {
  const snap = await db.collection('users').get()
  console.log(`Scanning ${snap.size} users...`)

  let updated = 0
  let skipped = 0
  const batchSize = 400
  let batch = db.batch()
  let opsInBatch = 0

  for (const docSnap of snap.docs) {
    const data = docSnap.data()
    if (data.approvalStatus) {
      skipped++
      continue
    }
    const status = (data.role === 'admin' || data.role === 'ministry_leader')
      ? 'approved'
      : 'pending'
    batch.update(docSnap.ref, {
      approvalStatus: status,
      approvedBy: data.approvedBy ?? null,
      approvedAt: data.approvedAt ?? null,
      approvalNote: data.approvalNote ?? '',
      requestedMinistryIds: Array.isArray(data.requestedMinistryIds) ? data.requestedMinistryIds : [],
      updatedAt: Timestamp.now(),
    })
    updated++
    opsInBatch++
    if (opsInBatch >= batchSize) {
      await batch.commit()
      batch = db.batch()
      opsInBatch = 0
    }
  }

  if (opsInBatch > 0) await batch.commit()
  console.log(`Updated: ${updated}. Skipped (already had approvalStatus): ${skipped}.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
