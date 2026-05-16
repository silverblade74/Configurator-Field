import { collection, addDoc, getDocs, query, orderBy, limit, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'

export async function logAuditEvent({ action, targetCollection, targetId, performedBy, details }) {
  return addDoc(collection(db, 'auditLogs'), {
    action,
    targetCollection: targetCollection || null,
    targetId: targetId || null,
    performedBy: performedBy || null,
    details: details || null,
    timestamp: serverTimestamp(),
  })
}

export async function getAuditLogs(maxResults = 100) {
  const q = query(
    collection(db, 'auditLogs'),
    orderBy('timestamp', 'desc'),
    limit(maxResults),
  )
  const snapshot = await getDocs(q)
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
}
