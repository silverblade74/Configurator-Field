export function resolveFirebaseProjectId(env = process.env) {
  return env.FIREBASE_PROJECT_ID || env.GCLOUD_PROJECT || env.GOOGLE_CLOUD_PROJECT || null
}

export function buildAdminAppOptions({ credential, env = process.env } = {}) {
  const projectId = resolveFirebaseProjectId(env)
  return {
    ...(credential ? { credential } : {}),
    ...(projectId ? { projectId } : {}),
  }
}

export function createFirebaseCliCredential({ requireFn, cwd = process.cwd() } = {}) {
  if (!requireFn) return null

  let authTools
  let apiV2
  try {
    authTools = requireFn('firebase-tools/lib/auth')
    apiV2 = requireFn('firebase-tools/lib/apiv2')
  } catch {
    return null
  }

  const account = authTools.getProjectDefaultAccount?.(cwd)
    || authTools.getGlobalDefaultAccount?.()
  const refreshToken = account?.tokens?.refresh_token
  if (!refreshToken) return null

  return {
    source: account.user?.email ? `Firebase CLI account ${account.user.email}` : 'Firebase CLI account',
    credential: {
      async getAccessToken() {
        authTools.setRefreshToken(refreshToken)
        return {
          access_token: await apiV2.getAccessToken(),
          expires_in: 3600,
        }
      },
    },
  }
}

export function isMissingAdminCredentialError(error) {
  return error?.code === 'app/invalid-credential'
    && /default credentials|access token|credential/i.test(error.message || '')
}

export function getAdminCredentialSetupMessage({ projectId, email } = {}) {
  const project = projectId || 'your-project-id'
  const adminEmail = email || 'admin@example.com'
  return [
    'Firebase Admin credentials are required to promote an account.',
    'Set SERVICE_ACCOUNT_KEY to the JSON contents of a Firebase service account key, or sign in with a Firebase CLI account that has Firebase Auth Admin and Firestore write access, then rerun:',
    '$env:SERVICE_ACCOUNT_KEY = Get-Content C:\\path\\to\\serviceAccountKey.json -Raw',
    `$env:FIREBASE_PROJECT_ID="${project}"; $env:ADMIN_EMAIL="${adminEmail}"; npm.cmd run promote:admin`,
  ].join('\n')
}
