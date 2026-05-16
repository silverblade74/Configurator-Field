import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { UserCheck, LogIn, UserPlus, AlertCircle, Loader2 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../components/ToastProvider'
import { getVolunteerByClaimToken, claimVolunteerProfile } from '../services/firestore'

export default function ClaimProfile() {
  const { token } = useParams()
  const navigate = useNavigate()
  const { currentUser, setUserProfile } = useAuth()
  const addToast = useToast()
  const [volunteer, setVolunteer] = useState(null)
  const [loading, setLoading] = useState(true)
  const [claiming, setClaiming] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function lookup() {
      try {
        const vol = await getVolunteerByClaimToken(token)
        if (!vol) setError('This claim link is invalid or has already been used.')
        else if (vol.claimed) setError('This profile has already been claimed.')
        else setVolunteer(vol)
      } catch (err) { setError('Something went wrong. Please try again later.') }
      setLoading(false)
    }
    lookup()
  }, [token])

  async function handleClaim() {
    if (!currentUser) return
    setClaiming(true)
    try {
      const merged = await claimVolunteerProfile(volunteer.id, currentUser)
      setUserProfile(merged)
      localStorage.removeItem('pendingClaimToken')
      addToast.success('Profile claimed successfully! Welcome aboard.')
      navigate('/dashboard')
    } catch (err) { setError('Failed to claim profile. Please try again.') }
    setClaiming(false)
  }

  function handleAuthRedirect(path) {
    localStorage.setItem('pendingClaimToken', token)
    navigate(`${path}?redirect=/claim/${token}`)
  }

  if (loading) return (<div className="min-h-screen flex items-center justify-center bg-gray-50"><Loader2 className="w-8 h-8 animate-spin text-primary-600" /></div>)

  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full text-center"><div className="card">
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-800 mb-2">Unable to Claim</h2>
        <p className="text-gray-500 mb-6">{error}</p>
        <Link to="/login" className="btn-primary inline-block">Go to Login</Link>
      </div></div>
    </div>
  )

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <span className="text-5xl">⛪</span>
          <h1 className="text-2xl font-bold mt-4">Claim Your Profile</h1>
        </div>
        <div className="card text-center">
          <UserCheck className="w-12 h-12 text-primary-600 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-800 mb-2">Hi, {volunteer.displayName || 'Volunteer'}!</h2>
          <p className="text-gray-500 mb-6">A volunteer profile was created for you at VolunteerHub. Claim it to track your hours, earn badges, and stay connected.</p>
          {currentUser ? (
            <div className="space-y-3">
              <p className="text-sm text-gray-500">Logged in as <span className="font-medium text-gray-700">{currentUser.email}</span></p>
              <button onClick={handleClaim} disabled={claiming} className="btn-primary w-full flex items-center justify-center gap-2">
                {claiming ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4" />}
                {claiming ? 'Claiming...' : 'Claim This Profile'}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-gray-500 mb-4">Sign up or log in to claim this profile.</p>
              <button onClick={() => handleAuthRedirect('/register')} className="btn-primary w-full flex items-center justify-center gap-2"><UserPlus className="w-4 h-4" />Sign Up to Claim</button>
              <button onClick={() => handleAuthRedirect('/login')} className="w-full flex items-center justify-center gap-2 border border-gray-300 rounded-lg px-4 py-2 hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700"><LogIn className="w-4 h-4" />Log In to Claim</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
