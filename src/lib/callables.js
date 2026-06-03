import { httpsCallable } from 'firebase/functions'
import { functions } from '../firebase'

function callable(name) {
  const fn = httpsCallable(functions, name)
  return async (data = {}) => {
    const result = await fn(data)
    return result.data
  }
}

export const api = {
  ensureProfile: callable('ensureProfile'),
  approvePendingUser: callable('approvePendingUser'),
  rejectPendingUser: callable('rejectPendingUser'),
  updateUserRole: callable('updateUserRole'),
  createManagedVolunteerProfile: callable('createManagedVolunteerProfile'),
  createProfileClaimCode: callable('createProfileClaimCode'),
  claimManagedVolunteerProfile: callable('claimManagedVolunteerProfile'),
  saveMinistry: callable('saveMinistry'),
  disableMinistry: callable('disableMinistry'),
  saveEvent: callable('saveEvent'),
  createEventSignup: callable('createEventSignup'),
  checkInEventVolunteer: callable('checkInEventVolunteer'),
  checkOutEventVolunteer: callable('checkOutEventVolunteer'),
}
