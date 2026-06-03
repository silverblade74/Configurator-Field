import { initializeApp, cert, applicationDefault, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { buildAdminAppOptions } from './firebase-admin-config.mjs'

export function initAdminApp() {
  if (getApps().length === 0) {
    const credential = process.env.SERVICE_ACCOUNT_KEY
      ? cert(JSON.parse(process.env.SERVICE_ACCOUNT_KEY))
      : applicationDefault()
    initializeApp(buildAdminAppOptions({ credential }))
  }
  return { db: getFirestore() }
}
