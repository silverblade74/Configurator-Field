import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  increment,
  Timestamp,
} from 'firebase/firestore'
import { db } from '../firebase'
import { calculatePoints, getMilestoneBonus } from '../utils/gamification'

// ─── Ministries ──────────────────────────────────────────────

export async function getMinistries() {
  const q = query(collection(db, 'ministries'), orderBy('name'))
  const snapshot = await getDocs(q)
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export async function createMinistry(data) {
  return addDoc(collection(db, 'ministries'), {
    ...data,
    memberCount: 0,
    createdAt: serverTimestamp(),
  })
}

export async function updateMinistry(id, data) {
  return updateDoc(doc(db, 'ministries', id), {
    ...data,
    updatedAt: serverTimestamp(),
  })
}

export async function deleteMinistry(id) {
  return deleteDoc(doc(db, 'ministries', id))
}

// ─── Events ──────────────────────────────────────────────────

export async function getEvents(filters = {}) {
  let q = collection(db, 'events')
  const constraints = [orderBy('date', 'desc')]

  if (filters.ministryId) {
    constraints.unshift(where('ministryId', '==', filters.ministryId))
  }
  if (filters.upcoming) {
    constraints.unshift(where('date', '>=', Timestamp.now()))
  }

  q = query(q, ...constraints)
  const snapshot = await getDocs(q)
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export async function getEvent(id) {
  const snapshot = await getDoc(doc(db, 'events', id))
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null
}

export async function getEventsByIds(ids) {
  if (!ids.length) return []
  const unique = [...new Set(ids)]
  const results = {}
  // Firestore 'in' queries support max 30 items
  for (let i = 0; i < unique.length; i += 30) {
    const batch = unique.slice(i, i + 30)
    const q = query(collection(db, 'events'), where('__name__', 'in', batch))
    const snapshot = await getDocs(q)
    snapshot.docs.forEach((d) => { results[d.id] = { id: d.id, ...d.data() } })
  }
  return results
}

export async function createEvent(data) {
  return addDoc(collection(db, 'events'), {
    ...data,
    signupCount: 0,
    createdAt: serverTimestamp(),
  })
}

export async function updateEvent(id, data) {
  return updateDoc(doc(db, 'events', id), {
    ...data,
    updatedAt: serverTimestamp(),
  })
}

export async function deleteEvent(id) {
  return deleteDoc(doc(db, 'events', id))
}

// ─── Event Signups ───────────────────────────────────────────

export async function signUpForEvent(eventId, userId, userName) {
  const existing = query(
    collection(db, 'eventSignups'),
    where('eventId', '==', eventId),
    where('userId', '==', userId)
  )
  const snapshot = await getDocs(existing)
  if (!snapshot.empty) throw new Error('Already signed up')

  await addDoc(collection(db, 'eventSignups'), {
    eventId,
    userId,
    userName,
    status: 'signed_up', // signed_up | checked_in | checked_out | no_show
    checkedInAt: null,
    checkedOutAt: null,
    hoursLogged: 0,
    createdAt: serverTimestamp(),
  })

  await updateDoc(doc(db, 'events', eventId), {
    signupCount: increment(1),
  })
}

export async function cancelSignup(signupId, eventId) {
  await deleteDoc(doc(db, 'eventSignups', signupId))
  await updateDoc(doc(db, 'events', eventId), {
    signupCount: increment(-1),
  })
}

export async function getEventSignups(eventId) {
  const q = query(
    collection(db, 'eventSignups'),
    where('eventId', '==', eventId)
  )
  const snapshot = await getDocs(q)
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export async function getUserSignups(userId) {
  const q = query(
    collection(db, 'eventSignups'),
    where('userId', '==', userId)
  )
  const snapshot = await getDocs(q)
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
}

// ─── Check-in / Check-out ────────────────────────────────────

export async function checkIn(signupId) {
  return updateDoc(doc(db, 'eventSignups', signupId), {
    status: 'checked_in',
    checkedInAt: serverTimestamp(),
  })
}

export async function checkOut(signupId, userId, manualHours = null) {
  const signupRef = doc(db, 'eventSignups', signupId)
  const signupSnap = await getDoc(signupRef)
  if (!signupSnap.exists()) throw new Error('Signup not found')
  const signupData = signupSnap.data()

  let hoursLogged
  if (manualHours !== null && manualHours >= 0) {
    hoursLogged = Number(manualHours)
  } else {
    const checkedInAt = signupData.checkedInAt?.toDate()
    const now = new Date()
    hoursLogged = checkedInAt
      ? Math.round(((now - checkedInAt) / (1000 * 60 * 60)) * 100) / 100
      : 0
  }

  await updateDoc(signupRef, {
    status: 'checked_out',
    checkedOutAt: serverTimestamp(),
    hoursLogged,
  })

  // Log attendance
  await addDoc(collection(db, 'attendanceLogs'), {
    userId,
    signupId,
    eventId: signupData.eventId,
    checkedInAt: signupData.checkedInAt,
    checkedOutAt: Timestamp.now(),
    hoursLogged,
    createdAt: serverTimestamp(),
  })

  // Calculate points using gamification engine
  const userRef = doc(db, 'users', userId)
  const userSnap = await getDoc(userRef)
  const userData = userSnap.exists() ? userSnap.data() : {}
  const oldHours = userData.totalHours || 0
  const isFirstEvent = oldHours === 0
  let pointsEarned = calculatePoints(hoursLogged, isFirstEvent)
  pointsEarned += getMilestoneBonus(oldHours, oldHours + hoursLogged)

  await updateDoc(userRef, {
    totalHours: increment(hoursLogged),
    totalPoints: increment(pointsEarned),
    lastServedDate: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  // Log service hours
  await addDoc(collection(db, 'serviceHours'), {
    userId,
    eventId: signupData.eventId,
    hours: hoursLogged,
    points: pointsEarned,
    date: serverTimestamp(),
  })

  return { hoursLogged, pointsEarned }
}

// Admin: add a walk-in volunteer to an event (not pre-signed-up)
export async function adminAddVolunteer(eventId, userId, userName) {
  const existing = query(
    collection(db, 'eventSignups'),
    where('eventId', '==', eventId),
    where('userId', '==', userId)
  )
  const snapshot = await getDocs(existing)
  if (!snapshot.empty) throw new Error('Already added')

  const ref = await addDoc(collection(db, 'eventSignups'), {
    eventId,
    userId,
    userName,
    status: 'checked_in',
    checkedInAt: serverTimestamp(),
    checkedOutAt: null,
    hoursLogged: 0,
    createdAt: serverTimestamp(),
  })

  await updateDoc(doc(db, 'events', eventId), {
    signupCount: increment(1),
  })

  return ref
}

// Mark as "released" (early departure, not needed, etc.) with 0 hours
export async function releaseVolunteer(signupId) {
  return updateDoc(doc(db, 'eventSignups', signupId), {
    status: 'released',
    checkedOutAt: serverTimestamp(),
    hoursLogged: 0,
  })
}

// Mark as no-show
export async function markNoShow(signupId) {
  return updateDoc(doc(db, 'eventSignups', signupId), {
    status: 'no_show',
  })
}

// Assign a volunteer to a department for this specific event
export async function assignDepartment(signupId, department) {
  return updateDoc(doc(db, 'eventSignups', signupId), { department: department || null })
}

// ─── Leaderboard ─────────────────────────────────────────────

export async function getLeaderboard(limitCount = 20) {
  const q = query(
    collection(db, 'users'),
    where('role', '==', 'volunteer'),
    orderBy('totalPoints', 'desc'),
    limit(limitCount)
  )
  const snapshot = await getDocs(q)
  return snapshot.docs.map((d, i) => ({
    id: d.id,
    rank: i + 1,
    ...d.data(),
  }))
}

// ─── Badges & Milestones ─────────────────────────────────────

export const BADGE_DEFINITIONS = [
  { id: 'first_event', name: 'First Step', description: 'Attended your first event', icon: '⭐', condition: (user) => user.totalHours > 0 },
  { id: 'hours_10', name: 'Dedicated', description: 'Served 10+ hours', icon: '🕐', condition: (user) => user.totalHours >= 10 },
  { id: 'hours_50', name: 'Committed', description: 'Served 50+ hours', icon: '🔥', condition: (user) => user.totalHours >= 50 },
  { id: 'hours_100', name: 'Champion', description: 'Served 100+ hours', icon: '🏆', condition: (user) => user.totalHours >= 100 },
  { id: 'hours_250', name: 'Legend', description: 'Served 250+ hours', icon: '👑', condition: (user) => user.totalHours >= 250 },
  { id: 'streak_4', name: 'Consistent', description: '4-week serving streak', icon: '📅', condition: (user) => user.streak >= 4 },
  { id: 'streak_12', name: 'Faithful', description: '12-week serving streak', icon: '💎', condition: (user) => user.streak >= 12 },
  { id: 'points_500', name: 'Rising Star', description: 'Earned 500+ points', icon: '🌟', condition: (user) => user.totalPoints >= 500 },
  { id: 'points_2000', name: 'All Star', description: 'Earned 2000+ points', icon: '✨', condition: (user) => user.totalPoints >= 2000 },
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
    await updateDoc(userRef, {
      badges: [...currentBadges, ...newBadges],
      updatedAt: serverTimestamp(),
    })
  }

  return newBadges.map((id) => BADGE_DEFINITIONS.find((b) => b.id === id))
}

// ─── Users (Admin) ───────────────────────────────────────────

export async function getAllUsers() {
  const q = query(collection(db, 'users'), orderBy('displayName'))
  const snapshot = await getDocs(q)
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export async function updateUserRole(userId, role) {
  return updateDoc(doc(db, 'users', userId), {
    role,
    updatedAt: serverTimestamp(),
  })
}

export async function getUserProfile(userId) {
  const snapshot = await getDoc(doc(db, 'users', userId))
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null
}

// Create a managed volunteer (no Firebase Auth account needed)
export async function createManagedVolunteer({ displayName, email, phone }) {
  const ref = await addDoc(collection(db, 'users'), {
    uid: null, // no auth account
    email: email || '',
    displayName: displayName || '',
    photoURL: '',
    phone: phone || '',
    role: 'volunteer',
    managed: true, // flag: admin-created, no login
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
  return updateDoc(doc(db, 'users', userId), {
    ...data,
    updatedAt: serverTimestamp(),
  })
}

export async function deleteVolunteer(userId) {
  return deleteDoc(doc(db, 'users', userId))
}

// ─── Reports ─────────────────────────────────────────────────

export async function getAttendanceLogs(filters = {}) {
  let constraints = [orderBy('createdAt', 'desc')]

  if (filters.userId) {
    constraints.unshift(where('userId', '==', filters.userId))
  }
  if (filters.eventId) {
    constraints.unshift(where('eventId', '==', filters.eventId))
  }

  const q = query(collection(db, 'attendanceLogs'), ...constraints)
  const snapshot = await getDocs(q)
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export async function getServiceHoursSummary() {
  const q = query(collection(db, 'serviceHours'), orderBy('date', 'desc'), limit(500))
  const snapshot = await getDocs(q)
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
}
