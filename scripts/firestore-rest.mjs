export function toFirestoreRestValue(value) {
  if (value === null) return { nullValue: null }
  if (value instanceof Date) return { timestampValue: value.toISOString() }
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(toFirestoreRestValue) } }
  }
  if (typeof value === 'boolean') return { booleanValue: value }
  if (typeof value === 'number') {
    if (Number.isInteger(value)) return { integerValue: String(value) }
    return { doubleValue: value }
  }
  if (typeof value === 'string') return { stringValue: value }
  if (value && typeof value === 'object') {
    return {
      mapValue: {
        fields: toFirestoreRestFields(value),
      },
    }
  }
  throw new TypeError(`Unsupported Firestore REST value: ${String(value)}`)
}

export function toFirestoreRestFields(data) {
  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => [key, toFirestoreRestValue(value)]),
  )
}

export function buildFirestorePatchUrl({ projectId, collection, documentId, fieldPaths }) {
  const path = [
    'https://firestore.googleapis.com/v1/projects',
    encodeURIComponent(projectId),
    'databases/(default)/documents',
    encodeURIComponent(collection),
    encodeURIComponent(documentId),
  ].join('/')
  const params = new URLSearchParams()
  for (const fieldPath of fieldPaths) {
    params.append('updateMask.fieldPaths', fieldPath)
  }
  return `${path}?${params.toString()}`
}

export async function patchFirestoreDocument({
  projectId,
  collection,
  documentId,
  data,
  accessToken,
  fetchImpl = fetch,
}) {
  const response = await fetchImpl(buildFirestorePatchUrl({
    projectId,
    collection,
    documentId,
    fieldPaths: Object.keys(data),
  }), {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields: toFirestoreRestFields(data) }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Firestore REST patch failed (${response.status}): ${body}`)
  }

  return response.json()
}
