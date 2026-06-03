import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AlertCircle, Loader2, LogIn, UserCheck, UserPlus } from 'lucide-react'
import Notice from '../components/Notice'
import { api } from '../lib/callables'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'

export default function ClaimProfile() {
  const { token } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { currentUser, refreshProfile } = useAuth()
  const [code, setCode] = useState(token || '')
  const [message, setMessage] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (token) setCode(token)
  }, [token])

  async function claimProfile(event) {
    event?.preventDefault()
    if (!currentUser) return
    setBusy(true)
    setMessage(null)
    try {
      await api.claimManagedVolunteerProfile({ code })
      await refreshProfile()
      toast.success('Profile claimed successfully.')
      navigate('/dashboard')
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Claim failed.' })
    } finally {
      setBusy(false)
    }
  }

  function authRedirect(path) {
    const redirect = token ? `/claim/${token}` : '/claim-profile'
    navigate(`${path}?redirect=${encodeURIComponent(redirect)}`)
  }

  if (token && !currentUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <span className="text-5xl">⛪</span>
            <h1 className="mt-4 text-2xl font-bold">Claim Your Profile</h1>
          </div>
          <div className="card text-center">
            <UserCheck className="mx-auto mb-4 h-12 w-12 text-primary-600" />
            <p className="mb-6 text-gray-500">
              Sign up or log in to link this volunteer profile to your account.
            </p>
            <div className="space-y-3">
              <button onClick={() => authRedirect('/register')} className="btn-primary flex w-full items-center justify-center gap-2">
                <UserPlus className="h-4 w-4" />
                Sign Up to Claim
              </button>
              <button onClick={() => authRedirect('/login')} className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50">
                <LogIn className="h-4 w-4" />
                Log In to Claim
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (token && currentUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md">
          <div className="card text-center">
            {message ? (
              <div className="mb-4 text-left">
                <Notice type={message.type}>{message.text}</Notice>
              </div>
            ) : (
              <UserCheck className="mx-auto mb-4 h-12 w-12 text-primary-600" />
            )}
            <h1 className="mb-2 text-xl font-semibold">Claim Volunteer Profile</h1>
            <p className="mb-6 text-sm text-gray-500">Logged in as {currentUser.email}</p>
            <button onClick={claimProfile} disabled={busy} className="btn-primary flex w-full items-center justify-center gap-2">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4" />}
              {busy ? 'Claiming...' : 'Claim This Profile'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="text-2xl font-bold">Claim Volunteer Profile</h1>
      {message && <Notice type={message.type}>{message.text}</Notice>}
      {!currentUser && (
        <Notice type="warning" title="Sign in required">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>Log in before entering a claim code.</span>
            <Link to="/login?redirect=/claim-profile" className="font-medium text-primary-700 hover:underline">
              Log in
            </Link>
          </div>
        </Notice>
      )}
      <form className="card space-y-4" onSubmit={claimProfile}>
        <div>
          <label className="label">Claim Code</label>
          <input className="input font-mono" required value={code} onChange={(e) => setCode(e.target.value)} />
        </div>
        <button className="btn-primary w-full" disabled={busy || !currentUser}>
          {busy ? 'Claiming...' : 'Claim Profile'}
        </button>
      </form>
      {!message && !token && (
        <Notice type="info">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Use the code provided by an admin to link a managed volunteer profile.</span>
          </div>
        </Notice>
      )}
    </div>
  )
}
