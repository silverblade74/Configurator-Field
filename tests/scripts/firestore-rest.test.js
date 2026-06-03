import { describe, expect, it } from 'vitest'
import {
  buildFirestorePatchUrl,
  toFirestoreRestFields,
  toFirestoreRestValue,
} from '../../scripts/firestore-rest.mjs'

describe('toFirestoreRestValue', () => {
  it('serializes primitive profile fields', () => {
    expect(toFirestoreRestValue('admin')).toEqual({ stringValue: 'admin' })
    expect(toFirestoreRestValue(3)).toEqual({ integerValue: '3' })
    expect(toFirestoreRestValue(true)).toEqual({ booleanValue: true })
    expect(toFirestoreRestValue(null)).toEqual({ nullValue: null })
  })

  it('serializes arrays, maps, and timestamps', () => {
    const timestamp = new Date('2026-06-03T15:00:00.000Z')
    expect(toFirestoreRestFields({
      assignedMinistryIds: [],
      createdAt: timestamp,
      nested: { role: 'admin' },
    })).toEqual({
      assignedMinistryIds: { arrayValue: { values: [] } },
      createdAt: { timestampValue: '2026-06-03T15:00:00.000Z' },
      nested: { mapValue: { fields: { role: { stringValue: 'admin' } } } },
    })
  })
})

describe('buildFirestorePatchUrl', () => {
  it('targets the document with update masks for merge-like writes', () => {
    expect(buildFirestorePatchUrl({
      projectId: 'volunteer-app-844ed',
      collection: 'users',
      documentId: 'uid-123',
      fieldPaths: ['role', 'approvalStatus'],
    })).toBe('https://firestore.googleapis.com/v1/projects/volunteer-app-844ed/databases/(default)/documents/users/uid-123?updateMask.fieldPaths=role&updateMask.fieldPaths=approvalStatus')
  })
})
