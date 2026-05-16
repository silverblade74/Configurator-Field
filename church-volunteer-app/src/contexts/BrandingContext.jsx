import { createContext, useContext, useState, useEffect } from 'react'
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
  const [branding, setBranding] = useState({ ...DEFAULTS, loading: true })

  useEffect(() => {
    loadBranding()
  }, [])

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

  function refresh() {
    loadBranding()
  }

  const value = { ...branding, refresh }

  return (
    <BrandingContext.Provider value={value}>
      {children}
    </BrandingContext.Provider>
  )
}
