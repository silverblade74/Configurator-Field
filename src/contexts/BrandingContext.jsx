import { createContext, useContext, useState, useEffect } from 'react'
import { useAuth } from './AuthContext'
import { getBrandingSettings } from '../services/firestore'

const DEFAULTS = {
  churchName: 'VolunteerHub',
  primaryColor: '#2563eb',
  logoUrl: '',
}

const BrandingContext = createContext()

export function useBranding() {
  return useContext(BrandingContext)
}

export function BrandingProvider({ children }) {
  const { currentUser, loading: authLoading } = useAuth()
  const [branding, setBranding] = useState({ ...DEFAULTS, loading: true })

  useEffect(() => {
    if (authLoading) return
    if (!currentUser) {
      setBranding({ ...DEFAULTS, loading: false })
      return
    }
    loadBranding()
  }, [currentUser, authLoading])

  async function loadBranding() {
    try {
      const data = await getBrandingSettings()
      const merged = {
        churchName: data?.churchName || DEFAULTS.churchName,
        primaryColor: data?.primaryColor || DEFAULTS.primaryColor,
        logoUrl: data?.logoUrl || DEFAULTS.logoUrl,
        loading: false,
      }
      setBranding(merged)
      document.documentElement.style.setProperty('--color-primary', merged.primaryColor)
    } catch (err) {
      console.error('Error loading branding:', err)
      setBranding({ ...DEFAULTS, loading: false })
    }
  }

  function refresh() { loadBranding() }

  const value = { ...branding, refresh }

  return (
    <BrandingContext.Provider value={value}>
      {children}
    </BrandingContext.Provider>
  )
}
