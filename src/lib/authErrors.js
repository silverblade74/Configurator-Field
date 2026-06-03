const GOOGLE_REDIRECT_FALLBACK_CODES = new Set([
  'auth/cancelled-popup-request',
  'auth/operation-not-supported-in-this-environment',
  'auth/popup-blocked',
  'auth/popup-closed-by-user',
])

export function shouldUseGoogleRedirectFallback(error) {
  return GOOGLE_REDIRECT_FALLBACK_CODES.has(error?.code)
}

export function getAuthErrorMessage(error, fallback = 'Authentication failed. Please try again.') {
  if (error?.code === 'auth/unauthorized-domain') {
    return 'This domain is not authorized for Firebase Authentication. Add the site domain in Firebase Auth settings.'
  }
  if (error?.code === 'auth/operation-not-allowed') {
    return 'Google sign-in is not enabled for this Firebase project.'
  }
  if (error?.code === 'auth/account-exists-with-different-credential') {
    return 'An account already exists for this email with a different sign-in method.'
  }
  if (error?.code === 'auth/invalid-credential') {
    return 'Invalid email or password.'
  }
  return error?.message || fallback
}
