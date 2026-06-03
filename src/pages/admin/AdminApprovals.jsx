import { useEffect, useState } from 'react'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '../../firebase'
import { api } from '../../lib/callables'
import { useToast } from '../../contexts/ToastContext'

export default function AdminApprovals() {
  const toast = useToast()
  const [pendingUsers, setPendingUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)

  async function loadPendingUsers() {
    setLoading(true)
    const q = query(collection(db, 'users'), where('approvalStatus', '==', 'pending'))
    const snap = await getDocs(q)
    setPendingUsers(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })))
    setLoading(false)
  }

  useEffect(() => {
    loadPendingUsers()
  }, [])

  async function approve(userId) {
    setBusyId(userId)
    try {
      await api.approvePendingUser({ userId })
      toast.success('User approved')
      await loadPendingUsers()
    } catch (err) {
      toast.error(err.message || 'Approval failed')
    } finally {
      setBusyId(null)
    }
  }

  async function reject(userId) {
    const approvalNote = window.prompt('Optional rejection note') || ''
    setBusyId(userId)
    try {
      await api.rejectPendingUser({ userId, approvalNote })
      toast.success('User rejected')
      await loadPendingUsers()
    } catch (err) {
      toast.error(err.message || 'Rejection failed')
    } finally {
      setBusyId(null)
    }
  }

  if (loading) return <p className="text-sm text-gray-500">Loading pending approvals...</p>

  return (
    <section className="card">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Pending Approvals</h2>
        <span className="badge bg-blue-100 text-blue-700">{pendingUsers.length} pending</span>
      </div>
      {pendingUsers.length === 0 ? (
        <p className="text-sm text-gray-500">No pending users need review.</p>
      ) : (
        <div className="space-y-3">
          {pendingUsers.map((user) => (
            <div key={user.id} className="flex flex-col gap-3 rounded-lg border border-gray-100 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium">{user.displayName || user.email}</p>
                <p className="text-sm text-gray-500">{user.email || 'No email'}</p>
              </div>
              <div className="flex gap-2">
                <button className="btn-primary text-sm" disabled={busyId === user.id} onClick={() => approve(user.id)}>
                  {busyId === user.id ? 'Working...' : 'Approve'}
                </button>
                <button className="btn-secondary text-sm" disabled={busyId === user.id} onClick={() => reject(user.id)}>
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
