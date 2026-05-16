import { useMemo } from 'react'
import { collection, query, where } from 'firebase/firestore'
import { db } from '../firebase'
import { useFirestoreListener } from './useFirestoreListener'

export function useEventRealtime(eventId) {
  const queryRef = useMemo(() => {
    if (!eventId) return null
    return query(collection(db, 'eventSignups'), where('eventId', '==', eventId))
  }, [eventId])

  return useFirestoreListener(queryRef)
}
