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
