import { initAdminApp } from './firebase-admin-app.mjs'

if (process.env.CONFIRM_RESET !== 'RESET_VOLUNTEERHUB') {
  console.error('Refusing to reset. Set CONFIRM_RESET=RESET_VOLUNTEERHUB to continue.')
  process.exit(1)
}

const { db } = initAdminApp()
const collections = ['auditLogs', 'attendanceLogs', 'serviceHours', 'eventSignups', 'events', 'claimCodes', 'ministries']

async function deleteCollection(name) {
  const snap = await db.collection(name).get()
  const batch = db.batch()
  snap.docs.forEach((doc) => batch.delete(doc.ref))
  if (!snap.empty) await batch.commit()
  console.log(`Deleted ${snap.size} docs from ${name}`)
}

for (const name of collections) {
  await deleteCollection(name)
}

console.log('Launch data reset complete. User profiles were not deleted.')
