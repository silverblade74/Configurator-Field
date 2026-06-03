import { describe, expect, it } from 'vitest'
import { APPROVAL_STATUS, ROLES, isApprovedProfile, isPrivilegedRole } from './schema'

describe('schema helpers', () => {
  it('detects privileged roles', () => {
    expect(isPrivilegedRole(ROLES.ADMIN)).toBe(true)
    expect(isPrivilegedRole(ROLES.MINISTRY_LEADER)).toBe(true)
    expect(isPrivilegedRole(ROLES.VOLUNTEER)).toBe(false)
    expect(isPrivilegedRole(ROLES.PENDING)).toBe(false)
  })

  it('detects approved profiles', () => {
    expect(isApprovedProfile({ approvalStatus: APPROVAL_STATUS.APPROVED })).toBe(true)
    expect(isApprovedProfile({ approvalStatus: APPROVAL_STATUS.PENDING })).toBe(false)
    expect(isApprovedProfile(null)).toBe(false)
  })
})
