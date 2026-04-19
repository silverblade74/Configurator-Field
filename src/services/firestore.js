import {
  collection, doc, addDoc, updateDoc, deleteDoc, getDoc, getDocs,
  query, where, orderBy, limit, serverTimestamp, increment, Timestamp,
} from 'firebase/firestore'
import { db } from '../firebase'

// --- Ministries ---

export async function getMinistries() {
  const q = query(collection(db, 'ministries'), orderBy('name'))
  const snapshot = await getDocs(q)
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export async function createMinistry(data) {
  return addDoc(collection(db, 'ministries'), { ...data, memberCount: 0, createdAt: serverTimestamp() })
}

export async function updateMinistry(id, data) {
  return updateDoc(doc(db, 'ministries', id), { ...data, updatedAt: serverTimestamp() })
}

export async function deleteMinistry(id) {
  return deleteDoc(doc(db, 'ministries', id))
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

export async function createEvent(data) {
  return addDoc(collection(db, 'events'), { ...data, signupCount: 0, createdAt: serverTimestamp() })
}

export async function updateEvent(id, data) {
  return updateDoc(doc(db, 'events', id), { ...data, updatedAt: serverTimestamp() })
}

export async function deleteEvent(id) {
  return deleteDoc(doc(db, 'events', id))
}

// --- Event Signups ---

export async function signUpForEvent(eventId, userId, userName) {
  const existing = query(collection(db, 'eventSignups'), where('eventId', '==', eventId), where('userId', '==', userId))
  const snapshot = await getDocs(existing)
  if (!snapshot.empty) throw new Error('Already signed up')

  await addDoc(collection(db, 'eventSignups'), {
    eventId, userId, userName, status: 'signed_up',
    checkedInAt: null, checkedOutAt: null, hoursLogged: 0, department: null, createdAt: serverTimestamp(),
  })
  await updateDoc(doc(db, 'events', eventId), { signupCount: increment(1) })
}

export async function cancelSignup(signupId, eventId) {
  await deleteDoc(doc(db, 'eventSignups', signupId))
  await updateDoc(doc(db, 'events', eventId), { signupCount: increment(-1) })
}

export async function getEventSignups(eventId) {
  const q = query(collection(db, 'eventSignups'), where('eventId', '==', eventId))
  const snapshot = await getDocs(q)
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export async function getUserSignups(userId) {
  const q = query(collection(db, 'eventSignups'), where('userId', '==', userId))
  const snapshot = await getDocs(q)
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
}

// --- Check-in / Check-out ---

export async function checkIn(signupId) {
  return updateDoc(doc(db, 'eventSignups', signupId), { status: 'checked_in', checkedInAt: serverTimestamp() })
}

export async function checkOut(signupId, userId, manualHours = null) {
  const signupRef = doc(db, 'eventSignups', signupId)
  const signupSnap = await getDoc(signupRef)
  const signupData = signupSnap.data()

  let hoursLogged
  if (manualHours !== null && manualHours >= 0) {
    hoursLogged = Number(manualHours)
  } else {
    const checkedInAt = signupData.checkedInAt?.toDate()
    const now = new Date()
    hoursLogged = checkedInAt ? Math.round(((now - checkedInAt) / (1000 * 60 * 60)) * 100) / 100 : 0
  }

  await updateDoc(signupRef, { status: 'checked_out', checkedOutAt: serverTimestamp(), hoursLogged })

  await addDoc(collection(db, 'attendanceLogs'), {
    userId, signupId, eventId: signupData.eventId,
    checkedInAt: signupData.checkedInAt, checkedOutAt: Timestamp.now(),
    hoursLogged, department: signupData.department || null, createdAt: serverTimestamp(),
  })

  const pointsEarned = Math.floor(hoursLogged * 10)
  await updateDoc(doc(db, 'users', userId), {
    totalHours: increment(hoursLogged), totalPoints: increment(pointsEarned),
    lastServedDate: serverTimestamp(), updatedAt: serverTimestamp(),
  })

  await addDoc(collection(db, 'serviceHours'), {
    userId, eventId: signupData.eventId, hours: hoursLogged, points: pointsEarned,
    department: signupData.department || null, date: serverTimestamp(),
  })

  return { hoursLogged, pointsEarned }
}

export async function adminAddVolunteer(eventId, userId, userName) {
  const existing = query(collection(db, 'eventSignups'), where('eventId', '==', eventId), where('userId', '==', userId))
  const snapshot = await getDocs(existing)
  if (!snapshot.empty) throw new Error('Already added')

  const ref = await addDoc(collection(db, 'eventSignups'), {
    eventId, userId, userName, status: 'checked_in',
    checkedInAt: serverTimestamp(), checkedOutAt: null, hoursLogged: 0,
    department: null, createdAt: serverTimestamp(),
  })
  await updateDoc(doc(db, 'events', eventId), { signupCount: increment(1) })
  return ref
}

export async function releaseVolunteer(signupId) {
  return updateDoc(doc(db, 'eventSignups', signupId), {
    status: 'released', checkedOutAt: serverTimestamp(), hoursLogged: 0,
  })
}

export async function markNoShow(signupId) {
  return updateDoc(doc(db, 'eventSignups', signupId), { status: 'no_show' })
}

// Assign a volunteer to a department for this specific event
export async function assignDepartment(signupId, department) {
  return updateDoc(doc(db, 'eventSignups', signupId), { department: department || null })
}

// --- Sessions (multi-session check-in/out) ---

// Pure helper. Returns the last session if it has no checkOutAt, else null.
// Tolerates legacy signups that have checkedInAt but no sessions[] by
// synthesizing a single-element view. The backfill script makes this branch
// unnecessary after rollout, but the fallback keeps pre-backfill clients safe.
export function getOpenSession(signup) {
  const sessions = Array.isArray(signup?.sessions) ? signup.sessions : null
  if (sessions && sessions.length > 0) {
    const last = sessions[sessions.length - 1]
    return last.checkOutAt ? null : last
  }
  // Legacy fallback
  if (signup?.checkedInAt && !signup?.checkedOutAt) {
    return { checkInAt: signup.checkedInAt, checkOutAt: null, hoursLogged: 0, department: signup.department || null }
  }
  return null
}

// Returns the effective session list for a signup, synthesizing one from
// legacy fields when `sessions` is missing. Read-only — does not mutate.
export function getSessions(signup) {
  if (Array.isArray(signup?.sessions)) return signup.sessions
  if (signup?.checkedInAt) {
    return [{
      checkInAt: signup.checkedInAt,
      checkOutAt: signup.checkedOutAt || null,
      hoursLogged: signup.hoursLogged || 0,
      department: signup.department || null,
    }]
  }
  return []
}

// Opens a new session on a signup. Fails loudly if one is already open.
// Writes sessions[] (append), status='checked_in', checkedInAt (first session only).
export async function startSession(signupId, department = null) {
  const ref = doc(db, 'eventSignups', signupId)
  const snap = await getDoc(ref)
  if (!snap.exists()) throw new Error('Signup not found')
  const data = snap.data()

  const existingOpen = getOpenSession({ ...data, id: snap.id })
  if (existingOpen) throw new Error('A session is already open for this volunteer')

  const existingSessions = Array.isArray(data.sessions) ? data.sessions : []
  const now = Timestamp.now()
  const newSession = { checkInAt: now, checkOutAt: null, hoursLogged: 0, department: department || null }

  const patch = {
    sessions: [...existingSessions, newSession],
    status: 'checked_in',
    checkedOutAt: null,
    department: department || null,
  }
  // Keep parent checkedInAt aligned with first session for legacy readers.
  if (existingSessions.length === 0) patch.checkedInAt = now

  await updateDoc(ref, patch)
}

// Closes the currently open session. manualHours overrides the clock math
// when supplied. Writes one /attendanceLogs row and one /serviceHours row,
// increments /users/{userId}.totalHours + totalPoints + lastServedDate.
// Matches today's checkOut side-effects, scoped to the closing session.
export async function endSession(signupId, userId, { manualHours = null } = {}) {
  const ref = doc(db, 'eventSignups', signupId)
  const snap = await getDoc(ref)
  if (!snap.exists()) throw new Error('Signup not found')
  const data = snap.data()

  const sessions = Array.isArray(data.sessions) ? [...data.sessions] : []
  const idx = sessions.length - 1
  const open = idx >= 0 ? sessions[idx] : null
  if (!open || open.checkOutAt) throw new Error('No open session to close')

  const now = Timestamp.now()
  let hoursLogged
  if (manualHours !== null && manualHours !== '' && Number(manualHours) >= 0) {
    hoursLogged = Number(manualHours)
  } else {
    const checkedInAt = open.checkInAt?.toDate?.() || open.checkInAt
    const start = checkedInAt instanceof Date ? checkedInAt : new Date(checkedInAt)
    hoursLogged = Math.round(((now.toDate() - start) / (1000 * 60 * 60)) * 100) / 100
  }

  if (!Number.isFinite(hoursLogged) || hoursLogged < 0) {
    throw new Error('Could not compute session hours — check-in time may be corrupt')
  }

  const closed = { ...open, checkOutAt: now, hoursLogged }
  sessions[idx] = closed
  const totalHours = sessions.reduce((sum, s) => sum + (s.hoursLogged || 0), 0)

  await updateDoc(ref, {
    sessions,
    hoursLogged: totalHours,
    status: 'checked_out',
    checkedOutAt: now,
  })

  await addDoc(collection(db, 'attendanceLogs'), {
    userId, signupId, eventId: data.eventId,
    checkedInAt: open.checkInAt, checkedOutAt: now,
    hoursLogged, department: closed.department || null,
    createdAt: serverTimestamp(),
  })

  const pointsEarned = Math.floor(hoursLogged * 10)
  if (userId) {
    await updateDoc(doc(db, 'users', userId), {
      totalHours: increment(hoursLogged),
      totalPoints: increment(pointsEarned),
      lastServedDate: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    await addDoc(collection(db, 'serviceHours'), {
      userId, eventId: data.eventId, hours: hoursLogged, points: pointsEarned,
      department: closed.department || null, date: serverTimestamp(),
    })
  }

  return { hoursLogged, pointsEarned }
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
  { id: 'hours_250', name: 'Legend', description: 'Served 250+ hours', icon: '\uD83D\uDC51', condition: (user) => user.totalHours >= 250 },
  { id: 'streak_4', name: 'Consistent', description: '4-week serving streak', icon: '\uD83D\uDCC5', condition: (user) => user.streak >= 4 },
  { id: 'streak_12', name: 'Faithful', description: '12-week serving streak', icon: '\uD83D\uDC8E', condition: (user) => user.streak >= 12 },
  { id: 'points_500', name: 'Rising Star', description: 'Earned 500+ points', icon: '\uD83C\uDF1F', condition: (user) => user.totalPoints >= 500 },
  { id: 'points_2000', name: 'All Star', description: 'Earned 2000+ points', icon: '\u2728', condition: (user) => user.totalPoints >= 2000 },
]

export const MILESTONES = [
  { hours: 1, name: 'Getting Started', message: 'You completed your first hour of service!' },
  { hours: 10, name: 'Making a Difference', message: 'You\'ve served 10 hours!' },
  { hours: 25, name: 'Quarter Century', message: 'You\'ve reached 25 hours of service!' },
  { hours: 50, name: 'Half Century', message: 'An incredible 50 hours of service!' },
  { hours: 100, name: 'Centurion', message: 'You\'ve hit 100 hours - amazing!' },
  { hours: 250, name: 'Pillar of Service', message: '250 hours of faithful service!' },
  { hours: 500, name: 'Hall of Fame', message: '500 hours - you\'re a true legend!' },
]

export async function checkAndAwardBadges(userId) {
  const userRef = doc(db, 'users', userId)
  const userSnap = await getDoc(userRef)
  const userData = userSnap.data()
  const currentBadges = userData.badges || []
  const newBadges = []

  for (const badge of BADGE_DEFINITIONS) {
    if (!currentBadges.includes(badge.id) && badge.condition(userData)) {
      newBadges.push(badge.id)
    }
  }

  if (newBadges.length > 0) {
    await updateDoc(userRef, { badges: [...currentBadges, ...newBadges], updatedAt: serverTimestamp() })
  }

  return newBadges.map((id) => BADGE_DEFINITIONS.find((b) => b.id === id))
}

// --- Users (Admin) ---

export async function getAllUsers() {
  const q = query(collection(db, 'users'), orderBy('displayName'))
  const snapshot = await getDocs(q)
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export async function updateUserRole(userId, role) {
  return updateDoc(doc(db, 'users', userId), { role, updatedAt: serverTimestamp() })
}

export async function getUserProfile(userId) {
  const snapshot = await getDoc(doc(db, 'users', userId))
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null
}

// Create a managed volunteer (no Firebase Auth account needed)
export async function createManagedVolunteer({ displayName, email, phone }) {
  const ref = await addDoc(collection(db, 'users'), {
    uid: null,
    email: email || '',
    displayName: displayName || '',
    photoURL: '',
    phone: phone || '',
    role: 'volunteer',
    managed: true,
    ministries: [],
    totalHours: 0,
    totalPoints: 0,
    badges: [],
    streak: 0,
    lastServedDate: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref
}

export async function updateVolunteerProfile(userId, data) {
  return updateDoc(doc(db, 'users', userId), { ...data, updatedAt: serverTimestamp() })
}

export async function deleteVolunteer(userId) {
  return deleteDoc(doc(db, 'users', userId))
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
  const snapshot = await getDocs(collection(db, 'serviceHours'))
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
}
