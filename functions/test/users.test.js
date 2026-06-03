import { describe, expect, it } from 'vitest'
import { APPROVAL_STATUS } from '../src/users.js'

describe('users module', () => {
  it('exports approval statuses', () => {
    expect(APPROVAL_STATUS.PENDING).toBe('pending')
    expect(APPROVAL_STATUS.APPROVED).toBe('approved')
    expect(APPROVAL_STATUS.REJECTED).toBe('rejected')
  })
})
