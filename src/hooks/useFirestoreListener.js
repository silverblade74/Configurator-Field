import { useState, useEffect } from 'react'
import { onSnapshot } from 'firebase/firestore'

export function useFirestoreListener(queryRef) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!queryRef) { setData([]); setLoading(false); return }
    setLoading(true)
    const unsubscribe = onSnapshot(queryRef,
      (snapshot) => { setData(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))); setLoading(false); setError(null) },
      (err) => { console.error('Firestore listener error:', err); setError(err.message); setLoading(false) }
    )
    return unsubscribe
  }, [queryRef])

  return { data, loading, error }
}
