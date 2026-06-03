import { useState } from 'react'
import { api } from '../../lib/callables'
import { useToast } from '../../contexts/ToastContext'

export default function ManagedVolunteers({ onCreated }) {
  const toast = useToast()
  const [form, setForm] = useState({ displayName: '', email: '', phone: '' })
  const [busy, setBusy] = useState(false)
  const [claimCode, setClaimCode] = useState(null)

  async function createVolunteer(event) {
    event.preventDefault()
    setBusy(true)
    setClaimCode(null)
    try {
      const result = await api.createManagedVolunteerProfile(form)
      toast.success('Managed volunteer created')
      setForm({ displayName: '', email: '', phone: '' })
      onCreated?.(result.userId)
    } catch (err) {
      toast.error(err.message || 'Could not create volunteer')
    } finally {
      setBusy(false)
    }
  }

  async function createClaim(userId) {
    setBusy(true)
    try {
      const result = await api.createProfileClaimCode({ managedUserId: userId })
      setClaimCode(result.code)
      toast.success('Claim code created')
    } catch (err) {
      toast.error(err.message || 'Could not create claim code')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Managed Volunteers</h2>
        <p className="text-sm text-gray-500">Create accountless profiles for walk-ins or volunteers without login accounts.</p>
      </div>
      <form className="grid gap-3 sm:grid-cols-3" onSubmit={createVolunteer}>
        <input className="input" required placeholder="Full name" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} />
        <input className="input" type="email" placeholder="Email optional" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <input className="input" type="tel" placeholder="Phone optional" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        <button className="btn-primary sm:col-span-3" disabled={busy}>{busy ? 'Saving...' : 'Create Managed Volunteer'}</button>
      </form>
      {claimCode && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
          Claim code: <span className="font-mono font-semibold">{claimCode}</span>
        </div>
      )}
      <button type="button" className="btn-secondary" disabled={busy} onClick={() => createClaim(window.prompt('Managed volunteer id'))}>
        Create Claim Code By User ID
      </button>
    </section>
  )
}
