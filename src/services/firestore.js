import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  Timestamp,
  where,
} from 'firebase/firestore'
import { db } from '../firebase'
import { api } from '../lib/callables'

function toDateMillis(value) {
  if (!value) return null
  if (typeof value.toMillis === 'function') return value.toMillis()
  if (value instanceof Date) return value.getTime()
  const numeric = Number(value)
  if (Number.isFinite(numeric)) return numeric
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeSignup(snapshot) {
  const data = snapshot.data()
  const sessions = Array.isArray(data.sessions) ? data.sessions : []
  const lastSession = sessions[sessions.length - 1] || {}
  return {
    id: snapshot.id,
    ...data,
    userName: data.userName || data.userNameSnapshot || 'Volunteer',
    department: data.department || data.departmentId || '',
    checkedInAt: data.checkedInAt || lastSession.checkInAt || null,
    checkedOutAt: data.checkedOutAt || lastSession.checkOutAt || null,
  }
}

// --- Ministries ---

export async function getMinistries() {
  const q = query(collection(db, 'ministries'), orderBy('name'))
  const snapshot = await getDocs(q)
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export async function createMinistry(data) {
  return api.saveMinistry(data)
}

export async function updateMinistry(id, data) {
  return api.saveMinistry({ id, ...data })
}

export async function deleteMinistry(id) {
  return api.disableMinistry({ id })
}

// --- Events ---

export async function getEvents(filters = {}) {
  let q = collection(db, 'events')
  const constraints = [orderBy('date', 'desc')]
  if (filters.ministryId) constraints.unshift(where('ministryId', '==', filters.ministryId))
  if (filters.upcoming) constraints.unshift(where('date', '>=', Timestamp.now()))
  q = query(q, ...constraints)
  const snapshot = await getDocs(q)
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export async function getEvent(id) {
  const snapshot = await getDoc(doc(db, 'events', id))
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null
}

export async function getEventsByIds(ids) {
  if (!ids.length) return {}
  const unique = [...new Set(ids)]
  const results = {}
  for (let i = 0; i < unique.length; i += 30) {
    const batch = unique.slice(i, i + 30)
    const q = query(collection(db, 'events'), where('__name__', 'in', batch))
    const snapshot = await getDocs(q)
    snapshot.docs.forEach((d) => {
      results[d.id] = { id: d.id, ...d.data() }
    })
  }
  return results
}

export async function createEvent(data) {
  return api.saveEvent({ ...data, dateMs: toDateMillis(data.date) })
}

export async function updateEvent(id, data) {
  return api.saveEvent({ id, ...data, dateMs: toDateMillis(data.date) })
}

export async function deleteEvent(id) {
  return api.archiveEvent({ id })
}

// --- Event Signups ---

export async function signUpForEvent(eventId, userId, userName, departmentId = '') {
  return api.createEventSignup({ eventId, userId, userName, departmentId })
}

export async function cancelSignup(signupId) {
  return api.cancelEventSignup({ signupId })
}

export async function getEventSignups(eventId) {
  const q = query(collection(db, 'eventSignups'), where('eventId', '==', eventId))
  const snapshot = await getDocs(q)
  return snapshot.docs.map(normalizeSignup)
}

export async function getUserSignups(userId) {
  if (!userId) return []
  const q = query(collection(db, 'eventSignups'), where('userId', '==', userId))
  const snapshot = await getDocs(q)
  return snapshot.docs.map(normalizeSignup)
}

// --- Check-in / Check-out ---

export async function checkIn(signupId) {
  return api.checkInEventVolunteer({ signupId })
}

export async function checkOut(signupId, _userId, manualHours = null) {
  return api.checkOutEventVolunteer({ signupId, manualHours })
}

export async function adminAddVolunteer(eventId, userId, userName) {
  const signup = await api.createEventSignup({ eventId, userId, userName })
  if (signup.signupId) await api.checkInEventVolunteer({ signupId: signup.signupId })
  return signup
}

export async function releaseVolunteer(signupId) {
  return api.releaseEventVolunteer({ signupId })
}

export async function markNoShow(signupId) {
  return api.markEventVolunteerNoShow({ signupId })
}

export async function createAndCheckInVolunteer(eventId, { displayName, phone, email, department }) {
  const volunteer = await api.createManagedVolunteerProfile({ displayName, phone, email })
  const signup = await api.createEventSignup({
    eventId,
    userId: volunteer.userId,
    userName: displayName,
    departmentId: department || '',
  })
  if (signup.signupId) await api.checkInEventVolunteer({ signupId: signup.signupId })
  return { volunteerId: volunteer.userId, signupId: signup.signupId }
}

export async function assignDepartment(signupId, department) {
  return api.updateEventSignupDepartment({ signupId, department })
}

// --- Leaderboard ---

export async function getLeaderboard(limitCount = 20) {
  const q = query(collection(db, 'users'), where('role', '==', 'volunteer'), orderBy('totalPoints', 'desc'), limit(limitCount))
  const snapshot = await getDocs(q)
  return snapshot.docs.map((d, i) => ({ id: d.id, rank: i + 1, ...d.data() }))
}

// --- Badges & Milestones ---

export const BADGE_DEFINITIONS = [
  { id: 'first_event', name: 'First Step', description: 'Attended your first event', icon: '\u2B50', condition: (user) => user.totalHours > 0 },
  { id: 'hours_10', name: 'Dedicated', description: 'Served 10+ hours', icon: '\uD83D\uDD50', condition: (user) => user.totalHours >= 10 },
  { id: 'hours_50', name: 'Committed', description: 'Served 50+ hours', icon: '\uD83D\uDD25', condition: (user) => user.totalHours >= 50 },
  { id: 'hours_100', name: 'Champion', description: 'Served 100+ hours', icon: '\uD83C\uDFC6', condition: (user) => user.totalHours >= 100 },
  { id: 'hours_250', name: 'Legend', description: 'Served 250 hours', icon: '\uD83D\uDC51', condition: (user) => user.totalHours >= 250 },
  { id: 'streak_4', name: 'Consistent', description: '4-week serving streak', icon: '\uD83D\uDCC5', condition: (user) => user.streak >= 4 },
  { id: 'streak_12', name: 'Faithful', description: '12-week serving streak', icon: '\uD83D\uDC8E', condition: (user) => user.streak >= 12 },
  { id: 'points_500', name: 'Rising Star', description: 'Earned 500+ points', icon: '\uD83C\uDF1F', condition: (user) => user.totalPoints >= 500 },
  { id: 'points_2000', name: 'All Star', description: 'Earned 2000+ points', icon: '\u2728', condition: (user) => user.totalPoints >= 2000 },
]

export const MILESTONES = [
  { hours: 1, name: 'Getting Started', message: 'You completed your first hour of service!' },
  { hours: 10, name: 'Making a Difference', message: "You've served 10 hours!" },
  { hours: 25, name: 'Quarter Century', message: "You've reached 25 hours of service!" },
  { hours: 50, name: 'Half Century', message: 'An incredible 50 hours of service!' },
  { hours: 100, name: 'Centurion', message: "You've hit 100 hours - amazing!" },
  { hours: 250, name: 'Pillar of Service', message: '250 hours of faithful service!' },
  { hours: 500, name: 'Hall of Fame', message: "500 hours - you're a true legend!" },
]

export async function checkAndAwardBadges() {
  return []
}

// --- Users (Admin) ---

export async function getAllUsers() {
  const q = query(collection(db, 'users'), orderBy('displayName'))
  const snapshot = await getDocs(q)
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export async function updateUserRole(userId, role) {
  return api.updateUserRole({ userId, role })
}

export async function getUserProfile(userId) {
  const snapshot = await getDoc(doc(db, 'users', userId))
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null
}

export async function createManagedVolunteer({ displayName, email, phone }) {
  return api.createManagedVolunteerProfile({ displayName, email, phone })
}

export async function updateVolunteerProfile(userId, data) {
  return api.updateUserProfileAsAdmin({ userId, ...data })
}

export async function deleteVolunteer(userId) {
  return api.deleteManagedVolunteerProfile({ userId })
}

export async function generateClaimForVolunteer(userId) {
  const result = await api.createProfileClaimCode({ managedUserId: userId })
  return result.code
}

export async function getVolunteerByClaimToken() {
  return null
}

export async function claimVolunteerProfile(_managedUserId, _authUser, code) {
  return api.claimManagedVolunteerProfile({ code })
}

// --- Reports ---

export async function getAttendanceLogs(filters = {}) {
  let constraints = [orderBy('createdAt', 'desc')]
  if (filters.userId) constraints.unshift(where('userId', '==', filters.userId))
  if (filters.eventId) constraints.unshift(where('eventId', '==', filters.eventId))
  const q = query(collection(db, 'attendanceLogs'), ...constraints)
  const snapshot = await getDocs(q)
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export async function getServiceHoursSummary() {
  const q = query(collection(db, 'serviceHours'), orderBy('date', 'desc'), limit(500))
  const snapshot = await getDocs(q)
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
}
