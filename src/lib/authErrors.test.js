import { describe, expect, it } from 'vitest'
import { getAuthErrorMessage, shouldUseGoogleRedirectFallback } from './authErrors'

describe('Google auth error handling', () => {
  it('falls back to redirect for popup environment failures', () => {
    expect(shouldUseGoogleRedirectFallback({ code: 'auth/popup-blocked' })).toBe(true)
    expect(shouldUseGoogleRedirectFallback({ code: 'auth/popup-closed-by-user' })).toBe(true)
    expect(shouldUseGoogleRedirectFallback({ code: 'auth/operation-not-supported-in-this-environment' })).toBe(true)
  })

  it('does not fall back for configuration errors', () => {
    expect(shouldUseGoogleRedirectFallback({ code: 'auth/unauthorized-domain' })).toBe(false)
    expect(shouldUseGoogleRedirectFallback({ code: 'auth/operation-not-allowed' })).toBe(false)
  })

  it('returns actionable Google configuration messages', () => {
    expect(getAuthErrorMessage({ code: 'auth/unauthorized-domain' })).toContain('authorized')
    expect(getAuthErrorMessage({ code: 'auth/operation-not-allowed' })).toContain('Google')
  })
})
