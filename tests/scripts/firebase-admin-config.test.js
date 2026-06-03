import { describe, expect, it } from 'vitest'
import {
  createFirebaseCliCredential,
  getAdminCredentialSetupMessage,
  isMissingAdminCredentialError,
  resolveFirebaseProjectId,
} from '../../scripts/firebase-admin-config.mjs'

describe('resolveFirebaseProjectId', () => {
  it('prefers FIREBASE_PROJECT_ID', () => {
    expect(resolveFirebaseProjectId({
      FIREBASE_PROJECT_ID: 'firebase-project',
      GCLOUD_PROJECT: 'gcloud-project',
      GOOGLE_CLOUD_PROJECT: 'google-cloud-project',
    })).toBe('firebase-project')
  })

  it('falls back to Google project environment variables', () => {
    expect(resolveFirebaseProjectId({ GCLOUD_PROJECT: 'gcloud-project' })).toBe('gcloud-project')
    expect(resolveFirebaseProjectId({ GOOGLE_CLOUD_PROJECT: 'google-cloud-project' })).toBe('google-cloud-project')
  })

  it('returns null when no project id is configured', () => {
    expect(resolveFirebaseProjectId({})).toBeNull()
  })
})

describe('isMissingAdminCredentialError', () => {
  it('detects missing application default credential errors', () => {
    expect(isMissingAdminCredentialError({
      code: 'app/invalid-credential',
      message: 'Could not load the default credentials.',
    })).toBe(true)
  })

  it('ignores unrelated Firebase Admin errors', () => {
    expect(isMissingAdminCredentialError({
      code: 'auth/user-not-found',
      message: 'There is no user record.',
    })).toBe(false)
  })
})

describe('getAdminCredentialSetupMessage', () => {
  it('prints the minimum setup command for this project and email', () => {
    expect(getAdminCredentialSetupMessage({
      projectId: 'volunteer-app-844ed',
      email: 'admin@example.com',
    })).toContain('$env:FIREBASE_PROJECT_ID="volunteer-app-844ed"; $env:ADMIN_EMAIL="admin@example.com"; npm.cmd run promote:admin')
  })
})

describe('createFirebaseCliCredential', () => {
  it('returns null when no Firebase CLI account is available', () => {
    const requireFn = (specifier) => {
      if (specifier === 'firebase-tools/lib/auth') {
        return {
          getProjectDefaultAccount: () => null,
          getGlobalDefaultAccount: () => null,
        }
      }
      if (specifier === 'firebase-tools/lib/apiv2') return {}
      throw new Error(`Unexpected module ${specifier}`)
    }

    expect(createFirebaseCliCredential({ requireFn, cwd: 'C:\\repo' })).toBeNull()
  })

  it('creates an Admin SDK credential from the active Firebase CLI account', async () => {
    const calls = []
    const requireFn = (specifier) => {
      if (specifier === 'firebase-tools/lib/auth') {
        return {
          getProjectDefaultAccount: () => ({
            user: { email: 'owner@example.com' },
            tokens: { refresh_token: 'refresh-token' },
          }),
          setRefreshToken: (token) => calls.push(['setRefreshToken', token]),
        }
      }
      if (specifier === 'firebase-tools/lib/apiv2') {
        return { getAccessToken: async () => 'access-token' }
      }
      throw new Error(`Unexpected module ${specifier}`)
    }

    const result = createFirebaseCliCredential({ requireFn, cwd: 'C:\\repo' })
    await expect(result.credential.getAccessToken()).resolves.toEqual({
      access_token: 'access-token',
      expires_in: 3600,
    })
    expect(result.source).toBe('Firebase CLI account owner@example.com')
    expect(calls).toEqual([['setRefreshToken', 'refresh-token']])
  })
})
