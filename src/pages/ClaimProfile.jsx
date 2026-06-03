import { useState } from 'react'
import Notice from '../components/Notice'
import { api } from '../lib/callables'
import { useAuth } from '../contexts/AuthContext'

export default function ClaimProfile() {
  const { refreshProfile } = useAuth()
  const [code, setCode] = useState('')
  const [message, setMessage] = useState(null)
  const [busy, setBusy] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setMessage(null)
    try {
      await api.claimManagedVolunteerProfile({ code })
      await refreshProfile()
      setMessage({ type: 'success', text: 'Profile claimed. Your service history is now linked to this account.' })
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Claim failed.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="text-2xl font-bold">Claim Volunteer Profile</h1>
      {message && <Notice type={message.type}>{message.text}</Notice>}
      <form className="card space-y-4" onSubmit={submit}>
        <div>
          <label className="label">Claim Code</label>
          <input className="input font-mono" required value={code} onChange={(e) => setCode(e.target.value)} />
        </div>
        <button className="btn-primary w-full" disabled={busy}>{busy ? 'Claiming...' : 'Claim Profile'}</button>
      </form>
    </div>
  )
}
