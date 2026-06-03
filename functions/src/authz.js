import { unauthenticated, permissionDenied } from './errors.js'

export const ROLES = Object.freeze({
  PENDING: 'pending',
  VOLUNTEER: 'volunteer',
  MINISTRY_LEADER: 'ministry_leader',
  ADMIN: 'admin',
})

export async function getActor(db, request) {
  const uid = request.auth?.uid
  if (!uid) throw unauthenticated()
  const snap = await db.collection('users').doc(uid).get()
  if (!snap.exists) throw permissionDenied('User profile is missing.')
  return { id: snap.id, ...snap.data() }
}

export function assertAdmin(actor) {
  if (actor?.role !== ROLES.ADMIN) {
    throw permissionDenied('Admin access is required.')
  }
}

export function assertLeaderOrAdmin(actor) {
  if (actor?.role !== ROLES.ADMIN && actor?.role !== ROLES.MINISTRY_LEADER) {
    throw permissionDenied('Leader or admin access is required.')
  }
}

export function canManageEvent(actor, event) {
  if (actor?.role === ROLES.ADMIN) return true
  if (actor?.role !== ROLES.MINISTRY_LEADER) return false
  const assigned = Array.isArray(actor.assignedMinistryIds) ? actor.assignedMinistryIds : []
  return Boolean(event?.ministryId && assigned.includes(event.ministryId))
}

export function assertCanManageEvent(actor, event) {
  if (!canManageEvent(actor, event)) {
    throw permissionDenied('You cannot manage this event.')
  }
}
