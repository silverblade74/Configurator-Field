import { db, FieldValue, Timestamp } from './admin.js'
import { assertCanManageEvent, getActor } from './authz.js'
import { failedPrecondition, invalidArgument, notFound } from './errors.js'
import { pointsForHours, badgeIdsForUser } from './gamification.js'
import { writeAuditLog } from './audit.js'

function currentOpenSession(signup) {
  const sessions = Array.isArray(signup.sessions) ? signup.sessions : []
  const last = sessions[sessions.length - 1]
  return last && !last.checkOutAt ? { index: sessions.length - 1, session: last } : null
}

async function loadSignupEvent(signupId) {
  const signupRef = db.collection('eventSignups').doc(signupId)
  const signupSnap = await signupRef.get()
  if (!signupSnap.exists) throw notFound('Signup not found.')
  const signup = { id: signupSnap.id, ...signupSnap.data() }
  const eventSnap = await db.collection('events').doc(signup.eventId).get()
  if (!eventSnap.exists) throw notFound('Event not found.')
  return { signupRef, signup, event: { id: eventSnap.id, ...eventSnap.data() } }
}

export async function checkInVolunteer(request) {
  const actor = await getActor(db, request)
  const signupId = request.data?.signupId
  if (!signupId) throw invalidArgument('Signup id is required.')
  const { signupRef, signup, event } = await loadSignupEvent(signupId)
  assertCanManageEvent(actor, event)
  if (currentOpenSession(signup)) throw failedPrecondition('Volunteer is already checked in.')
  const now = Timestamp.now()
  const sessions = Array.isArray(signup.sessions) ? signup.sessions : []
  sessions.push({
    checkInAt: now,
    checkInBy: actor.id,
    checkOutAt: null,
    checkOutBy: null,
    hoursLogged: 0,
    ministryId: signup.ministryId || event.ministryId,
    departmentId: signup.departmentId || event.ministryId,
  })
  await signupRef.update({
    sessions,
    status: 'checked_in',
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: actor.id,
  })
  await writeAuditLog(db, { actor, action: 'attendance.checkIn', targetType: 'eventSignup', targetId: signupId, metadata: { eventId: event.id } })
  return { ok: true }
}

export async function checkOutVolunteer(request) {
  const actor = await getActor(db, request)
  const signupId = request.data?.signupId
  if (!signupId) throw invalidArgument('Signup id is required.')
  const manualHours = request.data?.manualHours
  const { signupRef, signup, event } = await loadSignupEvent(signupId)
  assertCanManageEvent(actor, event)
  const open = currentOpenSession(signup)
  if (!open) throw failedPrecondition('Volunteer is not checked in.')
  const now = Timestamp.now()
  const start = open.session.checkInAt.toDate()
  const hours = manualHours !== undefined && manualHours !== null && manualHours !== ''
    ? Number(manualHours)
    : Math.round(((now.toMillis() - start.getTime()) / (1000 * 60 * 60)) * 100) / 100
  if (!Number.isFinite(hours) || hours < 0) throw invalidArgument('Hours must be zero or greater.')
  const sessions = [...signup.sessions]
  sessions[open.index] = {
    ...open.session,
    checkOutAt: now,
    checkOutBy: actor.id,
    hoursLogged: hours,
  }
  const totalSignupHours = sessions.reduce((sum, session) => sum + Number(session.hoursLogged || 0), 0)
  const points = pointsForHours(hours)
  const userRef = db.collection('users').doc(signup.userId)
  const userSnap = await userRef.get()
  if (!userSnap.exists) throw notFound('Volunteer profile not found.')
  const user = userSnap.data()
  const nextTotalHours = Number(user.totalHours || 0) + hours
  const nextTotalPoints = Number(user.totalPoints || 0) + points
  const nextBadges = [...new Set([...(user.badges || []), ...badgeIdsForUser({ ...user, totalHours: nextTotalHours, totalPoints: nextTotalPoints })])]
  const attendanceRef = db.collection('attendanceLogs').doc()
  const serviceRef = db.collection('serviceHours').doc()
  await db.runTransaction(async (tx) => {
    tx.update(signupRef, {
      sessions,
      status: 'checked_out',
      hoursLogged: totalSignupHours,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: actor.id,
    })
    tx.set(attendanceRef, {
      eventId: event.id,
      signupId,
      userId: signup.userId,
      checkInAt: open.session.checkInAt,
      checkOutAt: now,
      hoursLogged: hours,
      ministryId: signup.ministryId || event.ministryId,
      departmentId: signup.departmentId || event.ministryId,
      actorIds: [actor.id],
      createdAt: FieldValue.serverTimestamp(),
    })
    tx.set(serviceRef, {
      userId: signup.userId,
      eventId: event.id,
      signupId,
      attendanceLogId: attendanceRef.id,
      hours,
      points,
      date: now,
      ministryId: signup.ministryId || event.ministryId,
      departmentId: signup.departmentId || event.ministryId,
      createdAt: FieldValue.serverTimestamp(),
    })
    tx.update(userRef, {
      totalHours: FieldValue.increment(hours),
      totalPoints: FieldValue.increment(points),
      badges: nextBadges,
      lastServedDate: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: actor.id,
    })
  })
  await writeAuditLog(db, { actor, action: 'attendance.checkOut', targetType: 'eventSignup', targetId: signupId, metadata: { eventId: event.id, hours, points } })
  return { ok: true, hoursLogged: hours, pointsEarned: points }
}
