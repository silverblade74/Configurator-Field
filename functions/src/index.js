import { onCall } from 'firebase-functions/v2/https'
import {
  approveUser,
  deleteManagedVolunteer,
  claimManagedProfile,
  createClaimCode,
  createManagedVolunteer,
  ensureUserProfile,
  rejectUser,
  setUserRole,
  updateUserProfileAsAdmin as updateUserProfileAsAdminImpl,
} from './users.js'
import { archiveMinistry, upsertMinistry } from './ministries.js'
import { archiveEvent as archiveEventImpl, signUpForEvent, upsertEvent } from './events.js'
import {
  cancelSignup,
  checkInVolunteer,
  checkOutVolunteer,
  markNoShow,
  releaseVolunteer,
  updateSignupDepartment,
} from './attendance.js'

const callableOptions = {
  region: 'us-central1',
  cors: true,
}

export const ping = onCall(callableOptions, () => ({ ok: true, service: 'volunteerhub-functions' }))
export const ensureProfile = onCall(callableOptions, ensureUserProfile)
export const approvePendingUser = onCall(callableOptions, approveUser)
export const rejectPendingUser = onCall(callableOptions, rejectUser)
export const updateUserRole = onCall(callableOptions, setUserRole)
export const createManagedVolunteerProfile = onCall(callableOptions, createManagedVolunteer)
export const updateUserProfileAsAdmin = onCall(callableOptions, updateUserProfileAsAdminImpl)
export const deleteManagedVolunteerProfile = onCall(callableOptions, deleteManagedVolunteer)
export const createProfileClaimCode = onCall(callableOptions, createClaimCode)
export const claimManagedVolunteerProfile = onCall(callableOptions, claimManagedProfile)
export const saveMinistry = onCall(callableOptions, upsertMinistry)
export const disableMinistry = onCall(callableOptions, archiveMinistry)
export const saveEvent = onCall(callableOptions, upsertEvent)
export const archiveEvent = onCall(callableOptions, archiveEventImpl)
export const createEventSignup = onCall(callableOptions, signUpForEvent)
export const cancelEventSignup = onCall(callableOptions, cancelSignup)
export const updateEventSignupDepartment = onCall(callableOptions, updateSignupDepartment)
export const releaseEventVolunteer = onCall(callableOptions, releaseVolunteer)
export const markEventVolunteerNoShow = onCall(callableOptions, markNoShow)
export const checkInEventVolunteer = onCall(callableOptions, checkInVolunteer)
export const checkOutEventVolunteer = onCall(callableOptions, checkOutVolunteer)
