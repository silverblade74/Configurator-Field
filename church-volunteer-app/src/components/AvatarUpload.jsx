import { useState, useRef } from 'react'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { storage, db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from './ToastProvider'
import { Camera } from 'lucide-react'

function resizeImage(file, maxSize = 200) {
  return new Promise((resolve) => {
    const img = new Image()
    const reader = new FileReader()

    reader.onload = (e) => {
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = maxSize
        canvas.height = maxSize

        const ctx = canvas.getContext('2d')
        // Crop to square from center
        const minDim = Math.min(img.width, img.height)
        const sx = (img.width - minDim) / 2
        const sy = (img.height - minDim) / 2

        ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, maxSize, maxSize)

        canvas.toBlob(resolve, 'image/jpeg', 0.85)
      }
      img.src = e.target.result
    }
    reader.readAsDataURL(file)
  })
}

export default function AvatarUpload() {
  const { currentUser, userProfile, setUserProfile } = useAuth()
  const toast = useToast()
  const fileInputRef = useRef(null)
  const [uploading, setUploading] = useState(false)

  const photoURL = userProfile?.photoURL
  const initial = userProfile?.displayName?.charAt(0)?.toUpperCase() || '?'

  async function handleFileSelect(e) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file')
      return
    }

    setUploading(true)
    try {
      const resizedBlob = await resizeImage(file)
      const storageRef = ref(storage, `avatars/${currentUser.uid}.jpg`)
      await uploadBytes(storageRef, resizedBlob, { contentType: 'image/jpeg' })
      const downloadURL = await getDownloadURL(storageRef)

      await updateDoc(doc(db, 'users', currentUser.uid), {
        photoURL: downloadURL,
        updatedAt: serverTimestamp(),
      })

      setUserProfile((prev) => ({ ...prev, photoURL: downloadURL }))
      toast.success('Profile photo updated')
    } catch (err) {
      console.error('Error uploading avatar:', err)
      toast.error('Failed to upload photo')
    }
    setUploading(false)
    // Reset file input so re-selecting the same file triggers onChange
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className="relative group"
        title="Change profile photo"
      >
        {photoURL ? (
          <img
            src={photoURL}
            alt="Profile"
            className="w-16 h-16 rounded-full object-cover border-2 border-gray-200"
          />
        ) : (
          <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center text-2xl font-bold text-primary-600">
            {initial}
          </div>
        )}

        {/* Overlay */}
        <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          {uploading ? (
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
          ) : (
            <Camera size={18} className="text-white" />
          )}
        </div>

        {/* Uploading spinner always visible when uploading */}
        {uploading && (
          <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
          </div>
        )}
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelect}
      />
    </div>
  )
}
