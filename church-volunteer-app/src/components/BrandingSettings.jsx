import { useState, useEffect } from 'react'
import { useToast } from './ToastProvider'
import { useBranding } from '../contexts/BrandingContext'
import { getBrandingSettings, updateBrandingSettings } from '../services/firestore'
import { Palette, Save } from 'lucide-react'

export default function BrandingSettings() {
  const toast = useToast()
  const branding = useBranding()
  const [churchName, setChurchName] = useState('')
  const [primaryColor, setPrimaryColor] = useState('#2563eb')
  const [logoUrl, setLogoUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    loadSettings()
  }, [])

  async function loadSettings() {
    try {
      const data = await getBrandingSettings()
      if (data) {
        setChurchName(data.churchName || '')
        setPrimaryColor(data.primaryColor || '#2563eb')
        setLogoUrl(data.logoUrl || '')
      }
    } catch (err) {
      console.error('Error loading branding settings:', err)
    }
    setLoaded(true)
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await updateBrandingSettings({ churchName, primaryColor, logoUrl })
      branding.refresh()
      toast.success('Branding settings saved')
    } catch (err) {
      toast.error('Failed to save branding settings')
    }
    setSaving(false)
  }

  if (!loaded) return null

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-2">
        <Palette size={20} className="text-primary-600" />
        <h2 className="font-semibold text-lg">Branding Settings</h2>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className="label">Church Name</label>
          <input
            type="text"
            className="input"
            value={churchName}
            onChange={(e) => setChurchName(e.target.value)}
            placeholder="VolunteerHub"
          />
        </div>

        <div>
          <label className="label">Primary Color</label>
          <div className="flex items-center space-x-3">
            <input
              type="color"
              className="w-12 h-10 rounded border border-gray-300 cursor-pointer"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
            />
            <input
              type="text"
              className="input flex-1"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              placeholder="#2563eb"
            />
          </div>
        </div>

        <div>
          <label className="label">Logo URL</label>
          <input
            type="text"
            className="input"
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            placeholder="https://example.com/logo.png"
          />
        </div>

        {/* Preview */}
        <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
          <p className="text-xs text-gray-400 mb-3 uppercase tracking-wide">Preview</p>
          <div className="flex items-center space-x-3">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt="Logo preview"
                className="w-10 h-10 rounded object-cover"
                onError={(e) => { e.target.style.display = 'none' }}
              />
            ) : (
              <span className="text-2xl">&#9962;</span>
            )}
            <span
              className="font-bold text-lg"
              style={{ color: primaryColor }}
            >
              {churchName || 'VolunteerHub'}
            </span>
          </div>
        </div>

        <button
          type="submit"
          className="btn-primary flex items-center space-x-1"
          disabled={saving}
        >
          <Save size={16} />
          <span>{saving ? 'Saving...' : 'Save Settings'}</span>
        </button>
      </form>
    </div>
  )
}
