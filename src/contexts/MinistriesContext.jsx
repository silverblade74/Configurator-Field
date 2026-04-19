// src/contexts/MinistriesContext.jsx
import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { getMinistries } from '../services/firestore'

const MinistriesContext = createContext(null)

export function MinistriesProvider({ children }) {
  const [ministries, setMinistries] = useState([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getMinistries()
      setMinistries(data)
    } catch (err) {
      console.error('useMinistries refresh failed:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  return (
    <MinistriesContext.Provider value={{ ministries, loading, refresh }}>
      {children}
    </MinistriesContext.Provider>
  )
}

export function useMinistries() {
  const ctx = useContext(MinistriesContext)
  if (!ctx) throw new Error('useMinistries must be used inside <MinistriesProvider>')
  return ctx
}
