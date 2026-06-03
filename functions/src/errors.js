import { HttpsError } from 'firebase-functions/v2/https'

export function failedPrecondition(message) {
  return new HttpsError('failed-precondition', message)
}

export function invalidArgument(message) {
  return new HttpsError('invalid-argument', message)
}

export function notFound(message) {
  return new HttpsError('not-found', message)
}

export function permissionDenied(message) {
  return new HttpsError('permission-denied', message)
}

export function unauthenticated() {
  return new HttpsError('unauthenticated', 'Sign in is required.')
}
