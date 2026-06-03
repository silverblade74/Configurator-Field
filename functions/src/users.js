import { createHash, randomBytes } from 'node:crypto'
import { nanoid } from 'nanoid'
import { adminAuth, db, FieldValue, Timestamp } from './admin.js'
import { assertAdmin, assertLeaderOrAdmin, getActor, ROLES } from './authz.js'
import { failedPrecondition, invalidArgument, notFound, permissionDenied } from './errors.js'
import { writeAuditLog } from './audit.js'

export const APPROVAL_STATUS = Object.freeze({
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
})

function cleanString(value, fieldName, { required = false, max = 200 } = {}) {
  const text = typeof value === 'string' ? value.trim() : ''
  if (required && !text) throw invalidArgument(`${fieldName} is required.`)
  if (text.length > max) throw invalidArgument(`${fieldName} is too long.`)
  return text
}

function hashCode(code) {
  return createHash('sha256').update(code).digest('hex')
}

export async function ensureUserProfileImpl({ actorUid, authToken }) {
  if (!actorUid) throw permissionDenied('Authenticated user is required.')
  const ref = db.collection('users').doc(actorUid)
  const snap = await ref.get()
  if (snap.exists) return { id: snap.id, ...snap.data() }

  const email = cleanString(authToken?.email || '', 'email', { max: 320 })
  const displayName = cleanString(authToken?.name || authToken?.displayName || email, 'displayName', { max: 120 })
  const now = FieldValue.serverTimestamp()
  const profile = {
    uid: actorUid,
    email,
    displayName,
    phone: '',
    photoURL: authToken?.picture || '',
    role: ROLES.PENDING,
    approvalStatus: APPROVAL_STATUS.PENDING,
    approvalNote: '',
    approvedBy: null,
    approvedAt: null,
    managed: false,
    claimed: true,
    claimedBy: actorUid,
    claimedAt: now,
    assignedMinistryIds: [],
    totalHours: 0,
    totalPoints: 0,
    badges: [],
    streak: 0,
    lastServedDate: null,
    createdAt: now,
    updatedAt: now,
    createdBy: actorUid,
    updatedBy: actorUid,
  }
  await ref.set(profile)
  await adminAuth.setCustomUserClaims(actorUid, { role: ROLES.PENDING })
  return { id: actorUid, ...profile }
}

export async function approveUserImpl({ actor, targetUserId }) {
  assertAdmin(actor)
  const targetRef = db.collection('users').doc(targetUserId)
  const targetSnap = await targetRef.get()
  if (!targetSnap.exists) throw notFound('User not found.')
  const target = targetSnap.data()
  if (target.approvalStatus === APPROVAL_STATUS.APPROVED) {
    return { ok: true, alreadyApproved: true }
  }
  await targetRef.update({
    role: ROLES.VOLUNTEER,
    approvalStatus: APPROVAL_STATUS.APPROVED,
    approvalNote: '',
    approvedBy: actor.id,
    approvedAt: FieldValue.serverTimestamp(),
    updatedBy: actor.id,
    updatedAt: FieldValue.serverTimestamp(),
  })
  if (target.uid) {
    await adminAuth.setCustomUserClaims(target.uid, { role: ROLES.VOLUNTEER })
  }
  await writeAuditLog(db, {
    actor,
    action: 'user.approve',
    targetType: 'user',
    targetId: targetUserId,
  })
  return { ok: true }
}

export async function rejectUserImpl({ actor, targetUserId, approvalNote = '' }) {
  assertAdmin(actor)
  const note = cleanString(approvalNote, 'approvalNote', { max: 500 })
  const targetRef = db.collection('users').doc(targetUserId)
  const targetSnap = await targetRef.get()
  if (!targetSnap.exists) throw notFound('User not found.')
  await targetRef.update({
    role: ROLES.PENDING,
    approvalStatus: APPROVAL_STATUS.REJECTED,
    approvalNote: note,
    approvedBy: actor.id,
    approvedAt: FieldValue.serverTimestamp(),
    updatedBy: actor.id,
    updatedAt: FieldValue.serverTimestamp(),
  })
  const target = targetSnap.data()
  if (target.uid) {
    await adminAuth.setCustomUserClaims(target.uid, { role: ROLES.PENDING })
  }
  await writeAuditLog(db, {
    actor,
    action: 'user.reject',
    targetType: 'user',
    targetId: targetUserId,
    metadata: { hasNote: Boolean(note) },
  })
  return { ok: true }
}

export async function setUserRoleImpl({ actor, targetUserId, role, assignedMinistryIds = [] }) {
  assertAdmin(actor)
  if (!Object.values(ROLES).includes(role) || role === ROLES.PENDING) {
    throw invalidArgument('Role must be volunteer, ministry_leader, or admin.')
  }
  const targetRef = db.collection('users').doc(targetUserId)
  const targetSnap = await targetRef.get()
  if (!targetSnap.exists) throw notFound('User not found.')
  const target = targetSnap.data()
  const ministries = Array.isArray(assignedMinistryIds) ? assignedMinistryIds.filter(Boolean) : []
  await targetRef.update({
    role,
    approvalStatus: APPROVAL_STATUS.APPROVED,
    assignedMinistryIds: ministries,
    updatedBy: actor.id,
    updatedAt: FieldValue.serverTimestamp(),
  })
  if (target.uid) {
    await adminAuth.setCustomUserClaims(target.uid, { role })
  }
  await writeAuditLog(db, {
    actor,
    action: 'user.setRole',
    targetType: 'user',
    targetId: targetUserId,
    metadata: { role, assignedMinistryIds: ministries },
  })
  return { ok: true }
}

export async function createManagedVolunteerImpl({ actor, data }) {
  assertLeaderOrAdmin(actor)
  const displayName = cleanString(data?.displayName, 'displayName', { required: true, max: 120 })
  const email = cleanString(data?.email || '', 'email', { max: 320 })
  const phone = cleanString(data?.phone || '', 'phone', { max: 40 })
  const assignedMinistryIds = Array.isArray(data?.assignedMinistryIds) ? data.assignedMinistryIds.filter(Boolean) : []
  if (actor.role === ROLES.MINISTRY_LEADER) {
    const allowed = new Set(actor.assignedMinistryIds || [])
    if (assignedMinistryIds.some((id) => !allowed.has(id))) {
      throw permissionDenied('Leader cannot assign outside their ministries.')
    }
  }
  const ref = db.collection('users').doc()
  await ref.set({
    uid: null,
    email,
    displayName,
    phone,
    photoURL: '',
    role: ROLES.VOLUNTEER,
    approvalStatus: APPROVAL_STATUS.APPROVED,
    approvalNote: '',
    approvedBy: actor.id,
    approvedAt: FieldValue.serverTimestamp(),
    managed: true,
    claimed: false,
    claimedBy: null,
    claimedAt: null,
    assignedMinistryIds,
    totalHours: 0,
    totalPoints: 0,
    badges: [],
    streak: 0,
    lastServedDate: null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    createdBy: actor.id,
    updatedBy: actor.id,
  })
  await writeAuditLog(db, {
    actor,
    action: 'user.createManaged',
    targetType: 'user',
    targetId: ref.id,
  })
  return { ok: true, userId: ref.id }
}

export async function createClaimCodeImpl({ actor, managedUserId }) {
  assertAdmin(actor)
  const userRef = db.collection('users').doc(managedUserId)
  const userSnap = await userRef.get()
  if (!userSnap.exists) throw notFound('Managed volunteer not found.')
  const user = userSnap.data()
  if (!user.managed || user.claimed) throw failedPrecondition('Profile is not claimable.')
  const code = `${nanoid(6)}-${nanoid(6)}-${randomBytes(2).toString('hex')}`.toUpperCase()
  const ref = db.collection('claimCodes').doc()
  await ref.set({
    managedUserId,
    codeHash: hashCode(code),
    expiresAt: Timestamp.fromMillis(Date.now() + 14 * 24 * 60 * 60 * 1000),
    usedAt: null,
    usedBy: null,
    createdAt: FieldValue.serverTimestamp(),
    createdBy: actor.id,
    revokedAt: null,
    revokedBy: null,
  })
  await writeAuditLog(db, {
    actor,
    action: 'claimCode.create',
    targetType: 'user',
    targetId: managedUserId,
  })
  return { ok: true, claimCodeId: ref.id, code }
}

export async function claimManagedProfileImpl({ actorUid, code }) {
  const cleanCode = cleanString(code, 'code', { required: true, max: 80 }).toUpperCase()
  const codeHash = hashCode(cleanCode)
  const snap = await db.collection('claimCodes').where('codeHash', '==', codeHash).limit(1).get()
  if (snap.empty) throw notFound('Claim code not found.')
  const codeDoc = snap.docs[0]
  const claim = codeDoc.data()
  if (claim.revokedAt || claim.usedAt) throw failedPrecondition('Claim code is no longer valid.')
  if (claim.expiresAt.toMillis() < Date.now()) throw failedPrecondition('Claim code has expired.')
  const managedRef = db.collection('users').doc(claim.managedUserId)
  const authProfileRef = db.collection('users').doc(actorUid)
  await db.runTransaction(async (tx) => {
    const managedSnap = await tx.get(managedRef)
    if (!managedSnap.exists) throw notFound('Managed profile not found.')
    const managed = managedSnap.data()
    if (!managed.managed || managed.claimed) throw failedPrecondition('Profile has already been claimed.')
    const authSnap = await tx.get(authProfileRef)
    if (authSnap.exists && authSnap.id !== managedRef.id) {
      tx.delete(authProfileRef)
    }
    tx.update(managedRef, {
      uid: actorUid,
      managed: false,
      claimed: true,
      claimedBy: actorUid,
      claimedAt: FieldValue.serverTimestamp(),
      updatedBy: actorUid,
      updatedAt: FieldValue.serverTimestamp(),
    })
    tx.update(codeDoc.ref, {
      usedAt: FieldValue.serverTimestamp(),
      usedBy: actorUid,
    })
  })
  await adminAuth.setCustomUserClaims(actorUid, { role: ROLES.VOLUNTEER })
  return { ok: true, userId: claim.managedUserId }
}

export async function ensureUserProfile(request) {
  return ensureUserProfileImpl({ actorUid: request.auth?.uid, authToken: request.auth?.token })
}

export async function approveUser(request) {
  const actor = await getActor(db, request)
  return approveUserImpl({ actor, targetUserId: request.data?.userId })
}

export async function rejectUser(request) {
  const actor = await getActor(db, request)
  return rejectUserImpl({ actor, targetUserId: request.data?.userId, approvalNote: request.data?.approvalNote })
}

export async function setUserRole(request) {
  const actor = await getActor(db, request)
  return setUserRoleImpl({
    actor,
    targetUserId: request.data?.userId,
    role: request.data?.role,
    assignedMinistryIds: request.data?.assignedMinistryIds || [],
  })
}

export async function createManagedVolunteer(request) {
  const actor = await getActor(db, request)
  return createManagedVolunteerImpl({ actor, data: request.data || {} })
}

export async function createClaimCode(request) {
  const actor = await getActor(db, request)
  return createClaimCodeImpl({ actor, managedUserId: request.data?.managedUserId })
}

export async function claimManagedProfile(request) {
  return claimManagedProfileImpl({ actorUid: request.auth?.uid, code: request.data?.code })
}
