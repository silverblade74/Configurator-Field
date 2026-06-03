import { initializeApp, getApps } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore'

if (getApps().length === 0) {
  initializeApp()
}

export const adminAuth = getAuth()
export const db = getFirestore()
export { FieldValue, Timestamp }
