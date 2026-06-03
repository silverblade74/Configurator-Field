import { describe, expect, it } from 'vitest'
import { ROLES, canManageEvent } from '../src/authz.js'

describe('canManageEvent', () => {
  it('allows admins to manage any event', () => {
    expect(canManageEvent({ role: ROLES.ADMIN }, { ministryId: 'kids' })).toBe(true)
  })

  it('allows leaders to manage assigned ministry events', () => {
    const actor = { role: ROLES.MINISTRY_LEADER, assignedMinistryIds: ['kids'] }
    expect(canManageEvent(actor, { ministryId: 'kids' })).toBe(true)
  })

  it('blocks leaders from unassigned ministry events', () => {
    const actor = { role: ROLES.MINISTRY_LEADER, assignedMinistryIds: ['kids'] }
    expect(canManageEvent(actor, { ministryId: 'youth' })).toBe(false)
  })

  it('blocks volunteers', () => {
    expect(canManageEvent({ role: ROLES.VOLUNTEER }, { ministryId: 'kids' })).toBe(false)
  })
})
