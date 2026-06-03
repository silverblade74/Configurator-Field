import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing'
import { readFileSync } from 'node:fs'
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore'

let testEnv

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'volunteerhub-rules-test',
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  })
})

beforeEach(async () => {
  await testEnv.clearFirestore()
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore()
    await setDoc(doc(db, 'users/admin'), {
      role: 'admin',
      approvalStatus: 'approved',
      displayName: 'Admin',
    })
    await setDoc(doc(db, 'users/leader'), {
      role: 'ministry_leader',
      approvalStatus: 'approved',
      assignedMinistryIds: ['kids'],
      displayName: 'Leader',
    })
    await setDoc(doc(db, 'users/volunteer'), {
      role: 'volunteer',
      approvalStatus: 'approved',
      displayName: 'Volunteer',
      totalHours: 0,
    })
    await setDoc(doc(db, 'users/pending'), {
      role: 'pending',
      approvalStatus: 'pending',
      displayName: 'Pending',
    })
    await setDoc(doc(db, 'ministries/kids'), { name: 'Kids', active: true })
    await setDoc(doc(db, 'events/event1'), {
      title: 'Sunday Kids',
      ministryId: 'kids',
      status: 'active',
    })
    await setDoc(doc(db, 'eventSignups/signup1'), {
      userId: 'volunteer',
      eventId: 'event1',
      ministryId: 'kids',
      status: 'signed_up',
    })
    await setDoc(doc(db, 'attendanceLogs/log1'), {
      userId: 'volunteer',
      eventId: 'event1',
      ministryId: 'kids',
      hoursLogged: 1,
    })
  })
})

afterAll(async () => {
  await testEnv.cleanup()
})

function authed(uid) {
  return testEnv.authenticatedContext(uid, { sub: uid }).firestore()
}

describe('users rules', () => {
  it('allows users to read themselves', async () => {
    await assertSucceeds(getDoc(doc(authed('volunteer'), 'users/volunteer')))
  })

  it('blocks self role escalation', async () => {
    await assertFails(updateDoc(doc(authed('volunteer'), 'users/volunteer'), {
      role: 'admin',
    }))
  })

  it('allows safe profile updates', async () => {
    await assertSucceeds(updateDoc(doc(authed('volunteer'), 'users/volunteer'), {
      displayName: 'New Name',
    }))
  })

  it('blocks direct user creation', async () => {
    await assertFails(setDoc(doc(authed('newUser'), 'users/newUser'), {
      role: 'volunteer',
    }))
  })
})

describe('sensitive writes', () => {
  it('blocks client event signup creation', async () => {
    await assertFails(setDoc(doc(authed('volunteer'), 'eventSignups/newSignup'), {
      userId: 'volunteer',
      eventId: 'event1',
      ministryId: 'kids',
      status: 'signed_up',
    }))
  })

  it('blocks client attendance log creation', async () => {
    await assertFails(setDoc(doc(authed('leader'), 'attendanceLogs/newLog'), {
      userId: 'volunteer',
      eventId: 'event1',
      ministryId: 'kids',
      hoursLogged: 2,
    }))
  })

  it('blocks claim code reads', async () => {
    await assertFails(getDoc(doc(authed('admin'), 'claimCodes/secret')))
  })
})

describe('scoped reads', () => {
  it('allows assigned leader to read signup', async () => {
    await assertSucceeds(getDoc(doc(authed('leader'), 'eventSignups/signup1')))
  })

  it('allows volunteer to read own signup', async () => {
    await assertSucceeds(getDoc(doc(authed('volunteer'), 'eventSignups/signup1')))
  })
})
