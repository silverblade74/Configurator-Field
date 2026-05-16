import { collection, addDoc, getDocs, query, orderBy, limit, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'

export async function logAuditEvent({ action, targetCollection, targetId, performedBy, details }) {
  return addDoc(collection(db, 'auditLogs'), {
    action, targetCollection, targetId, performedBy,
    details: details || null, timestamp: serverTimestamp(),
  })
}

export async function getAuditLogs(limitCount = 100) {
  const q = query(collection(db, 'auditLogs'), orderBy('timestamp', 'desc'), limit(limitCount))
  const snapshot = await getDocs(q)
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
}
