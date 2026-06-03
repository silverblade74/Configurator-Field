import { onCall } from 'firebase-functions/v2/https'
import {
  approveUser,
  claimManagedProfile,
  createClaimCode,
  createManagedVolunteer,
  ensureUserProfile,
  rejectUser,
  setUserRole,
} from './users.js'
import { archiveMinistry, upsertMinistry } from './ministries.js'
import { signUpForEvent, upsertEvent } from './events.js'

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
export const createProfileClaimCode = onCall(callableOptions, createClaimCode)
export const claimManagedVolunteerProfile = onCall(callableOptions, claimManagedProfile)
export const saveMinistry = onCall(callableOptions, upsertMinistry)
export const disableMinistry = onCall(callableOptions, archiveMinistry)
export const saveEvent = onCall(callableOptions, upsertEvent)
export const createEventSignup = onCall(callableOptions, signUpForEvent)
