import { FieldValue } from './admin.js'

export async function writeAuditLog(db, { actor, action, targetType, targetId, metadata = {} }) {
  await db.collection('auditLogs').add({
    actorId: actor?.id || null,
    actorRole: actor?.role || null,
    action,
    targetType,
    targetId,
    metadata,
    createdAt: FieldValue.serverTimestamp(),
  })
}
