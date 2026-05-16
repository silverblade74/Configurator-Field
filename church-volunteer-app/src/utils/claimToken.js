const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

export function generateClaimToken(length = 20) {
  const values = crypto.getRandomValues(new Uint8Array(length))
  let token = ''
  for (let i = 0; i < length; i++) {
    token += CHARS[values[i] % CHARS.length]
  }
  return token
}
