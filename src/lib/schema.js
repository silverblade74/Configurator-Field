export const ROLES = Object.freeze({
  PENDING: 'pending',
  VOLUNTEER: 'volunteer',
  MINISTRY_LEADER: 'ministry_leader',
  ADMIN: 'admin',
})

export const APPROVAL_STATUS = Object.freeze({
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
})

export const EVENT_STATUS = Object.freeze({
  DRAFT: 'draft',
  ACTIVE: 'active',
  CANCELLED: 'cancelled',
  COMPLETED: 'completed',
})

export const SIGNUP_STATUS = Object.freeze({
  SIGNED_UP: 'signed_up',
  CHECKED_IN: 'checked_in',
  CHECKED_OUT: 'checked_out',
  RELEASED: 'released',
  NO_SHOW: 'no_show',
  CANCELLED: 'cancelled',
})

export const SIGNUP_SOURCE = Object.freeze({
  SELF: 'self',
  ADMIN: 'admin',
  WALK_IN: 'walk_in',
})

export function isPrivilegedRole(role) {
  return role === ROLES.ADMIN || role === ROLES.MINISTRY_LEADER
}

export function isApprovedProfile(profile) {
  return profile?.approvalStatus === APPROVAL_STATUS.APPROVED
}
