import { db, FieldValue, Timestamp } from './admin.js'
import { assertAdmin, getActor, ROLES } from './authz.js'
import { failedPrecondition, invalidArgument, notFound } from './errors.js'
import { writeAuditLog } from './audit.js'

function cleanText(value, fieldName, required = false) {
  const text = typeof value === 'string' ? value.trim() : ''
  if (required && !text) throw invalidArgument(`${fieldName} is required.`)
  return text
}

export async function upsertEvent(request) {
  const actor = await getActor(db, request)
  assertAdmin(actor)
  const id = request.data?.id || db.collection('events').doc().id
  const title = cleanText(request.data?.title, 'title', true)
  const dateMs = Number(request.data?.dateMs)
  if (!Number.isFinite(dateMs)) throw invalidArgument('Valid event date is required.')
  const ministryId = cleanText(request.data?.ministryId, 'ministryId', true)
  await db.collection('events').doc(id).set({
    title,
    description: cleanText(request.data?.description, 'description'),
    date: Timestamp.fromMillis(dateMs),
    location: cleanText(request.data?.location, 'location'),
    ministryId,
    maxVolunteers: request.data?.maxVolunteers ? Number(request.data.maxVolunteers) : null,
    durationHours: request.data?.durationHours ? Number(request.data.durationHours) : null,
    status: request.data?.status || 'active',
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: actor.id,
    createdAt: FieldValue.serverTimestamp(),
    createdBy: actor.id,
  }, { merge: true })
  await writeAuditLog(db, { actor, action: 'event.upsert', targetType: 'event', targetId: id })
  return { ok: true, eventId: id }
}

export async function signUpForEvent(request) {
  const actor = await getActor(db, request)
  if (actor.role === ROLES.PENDING || actor.approvalStatus !== 'approved') {
    throw failedPrecondition('Approval is required before signing up.')
  }
  const targetUserId = request.data?.userId || actor.id
  let targetUser = actor
  if (targetUserId !== actor.id) {
    assertAdmin(actor)
    const targetSnap = await db.collection('users').doc(targetUserId).get()
    if (!targetSnap.exists) throw notFound('Volunteer not found.')
    targetUser = { id: targetSnap.id, ...targetSnap.data() }
    if (targetUser.approvalStatus !== 'approved') {
      throw failedPrecondition('Volunteer approval is required before signing up.')
    }
  }
  const eventId = request.data?.eventId
  if (!eventId) throw invalidArgument('Event id is required.')
  const eventRef = db.collection('events').doc(eventId)
  const eventSnap = await eventRef.get()
  if (!eventSnap.exists) throw notFound('Event not found.')
  const event = eventSnap.data()
  if (event.status !== 'active') throw failedPrecondition('Event is not active.')

  const existing = await db.collection('eventSignups')
    .where('eventId', '==', eventId)
    .where('userId', '==', targetUserId)
    .limit(1)
    .get()
  if (!existing.empty) throw failedPrecondition('Already signed up.')

  if (event.maxVolunteers) {
    const signups = await db.collection('eventSignups').where('eventId', '==', eventId).get()
    if (signups.size >= event.maxVolunteers) throw failedPrecondition('Event is full.')
  }

  const signupRef = db.collection('eventSignups').doc()
  await signupRef.set({
    eventId,
    userId: targetUserId,
    userNameSnapshot: targetUser.displayName || targetUser.email || request.data?.userName || 'Volunteer',
    status: 'signed_up',
    source: targetUserId === actor.id ? 'self' : 'admin',
    ministryId: event.ministryId,
    departmentId: event.ministryId,
    sessions: [],
    hoursLogged: 0,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    createdBy: actor.id,
    updatedBy: actor.id,
  })
  await eventRef.update({ signupCount: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() })
  await writeAuditLog(db, { actor, action: 'event.signup', targetType: 'eventSignup', targetId: signupRef.id, metadata: { eventId } })
  return { ok: true, signupId: signupRef.id }
}
