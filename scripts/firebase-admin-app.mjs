import { initializeApp, cert, applicationDefault, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

export function initAdminApp() {
  if (getApps().length === 0) {
    if (process.env.SERVICE_ACCOUNT_KEY) {
      initializeApp({ credential: cert(JSON.parse(process.env.SERVICE_ACCOUNT_KEY)) })
    } else {
      initializeApp({ credential: applicationDefault() })
    }
  }
  return { db: getFirestore() }
}
