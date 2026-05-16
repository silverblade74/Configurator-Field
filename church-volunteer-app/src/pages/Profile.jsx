import { useState } from 'react'
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../components/ToastProvider'
import { formatHours, getLevel } from '../utils/gamification'
import { User, Mail, Phone, Clock, Star, Award } from 'lucide-react'
import AvatarUpload from '../components/AvatarUpload'

export default function Profile() {
  const toast = useToast()
  const { currentUser, userProfile, setUserProfile } = useAuth()
  const [editing, setEditing] = useState(false)
  const [displayName, setDisplayName] = useState(userProfile?.displayName || '')
  const [phone, setPhone] = useState(userProfile?.phone || '')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      await updateDoc(doc(db, 'users', currentUser.uid), {
        displayName,
        phone,
        updatedAt: serverTimestamp(),
      })
      setUserProfile((prev) => ({ ...prev, displayName, phone }))
      setEditing(false)
    } catch (err) {
      toast.error('Failed to update profile')
    }
    setSaving(false)
  }

  const level = getLevel(userProfile?.totalPoints || 0)

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">My Profile</h1>

      <div className="card">
        <div className="flex items-center space-x-4 mb-6">
          <AvatarUpload />
          <div>
            <h2 className="text-xl font-semibold">{userProfile?.displayName}</h2>
            <p className={`text-sm ${level.color} font-medium`}>{level.name} Level</p>
            <p className="text-xs text-gray-400 capitalize">{userProfile?.role?.replace('_', ' ')}</p>
          </div>
        </div>

        {editing ? (
          <div className="space-y-4">
            <div>
              <label className="label">Display Name</label>
              <input
                type="text"
                className="input"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Phone</label>
              <input
                type="tel"
                className="input"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(555) 123-4567"
              />
            </div>
            <div className="flex space-x-2">
              <button onClick={handleSave} className="btn-primary" disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button onClick={() => setEditing(false)} className="btn-secondary">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center space-x-3 text-sm">
              <Mail size={16} className="text-gray-400" />
              <span>{currentUser?.email}</span>
            </div>
            <div className="flex items-center space-x-3 text-sm">
              <User size={16} className="text-gray-400" />
              <span>{userProfile?.displayName || 'Not set'}</span>
            </div>
            <div className="flex items-center space-x-3 text-sm">
              <Phone size={16} className="text-gray-400" />
              <span>{userProfile?.phone || 'Not set'}</span>
            </div>
            <button onClick={() => setEditing(true)} className="btn-secondary mt-4">
              Edit Profile
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="card text-center">
          <Clock size={20} className="mx-auto text-primary-500 mb-1" />
          <p className="text-xl font-bold">{formatHours(userProfile?.totalHours || 0)}</p>
          <p className="text-xs text-gray-500">Hours Served</p>
        </div>
        <div className="card text-center">
          <Star size={20} className="mx-auto text-orange-500 mb-1" />
          <p className="text-xl font-bold">{userProfile?.totalPoints || 0}</p>
          <p className="text-xs text-gray-500">Points</p>
        </div>
        <div className="card text-center">
          <Award size={20} className="mx-auto text-purple-500 mb-1" />
          <p className="text-xl font-bold">{(userProfile?.badges || []).length}</p>
          <p className="text-xs text-gray-500">Badges</p>
        </div>
      </div>
    </div>
  )
}
