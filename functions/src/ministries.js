import { db, FieldValue } from './admin.js'
import { assertAdmin, getActor } from './authz.js'
import { invalidArgument, notFound } from './errors.js'
import { writeAuditLog } from './audit.js'

function cleanName(name) {
  const value = typeof name === 'string' ? name.trim() : ''
  if (!value) throw invalidArgument('Ministry name is required.')
  if (value.length > 120) throw invalidArgument('Ministry name is too long.')
  return value
}

export async function upsertMinistry(request) {
  const actor = await getActor(db, request)
  assertAdmin(actor)
  const id = request.data?.id || db.collection('ministries').doc().id
  const name = cleanName(request.data?.name)
  const ref = db.collection('ministries').doc(id)
  await ref.set({
    name,
    description: typeof request.data?.description === 'string' ? request.data.description.trim() : '',
    active: request.data?.active !== false,
    displayOrder: Number(request.data?.displayOrder || 0),
    leaderIds: Array.isArray(request.data?.leaderIds) ? request.data.leaderIds.filter(Boolean) : [],
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: actor.id,
    createdAt: FieldValue.serverTimestamp(),
    createdBy: actor.id,
  }, { merge: true })
  await writeAuditLog(db, { actor, action: 'ministry.upsert', targetType: 'ministry', targetId: id })
  return { ok: true, ministryId: id }
}

export async function archiveMinistry(request) {
  const actor = await getActor(db, request)
  assertAdmin(actor)
  const id = request.data?.id
  if (!id) throw invalidArgument('Ministry id is required.')
  const ref = db.collection('ministries').doc(id)
  const snap = await ref.get()
  if (!snap.exists) throw notFound('Ministry not found.')
  await ref.update({ active: false, updatedAt: FieldValue.serverTimestamp(), updatedBy: actor.id })
  await writeAuditLog(db, { actor, action: 'ministry.archive', targetType: 'ministry', targetId: id })
  return { ok: true }
}
