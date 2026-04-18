import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import Notice from '../components/Notice'
import { Calendar, Users, LogOut } from 'lucide-react'

export default function PendingApproval() {
  const { userProfile, approvalStatus, logout } = useAuth()
  const displayName = userProfile?.displayName || 'there'
  const note = userProfile?.approvalNote || ''

  return (
    <div className="max-w-xl mx-auto py-12 px-4 space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Thanks for registering, {displayName}!</h1>
      </div>

      {approvalStatus === 'rejected' ? (
        <Notice type="error" title="Your account was not approved">
          {note ? <p>Reason: {note}</p> : <p>Please contact a church admin for next steps.</p>}
        </Notice>
      ) : (
        <Notice type="info" title="Account pending review">
          An admin or ministry leader will review your request. You can browse events and ministries while you wait.
        </Notice>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Link to="/events" className="card flex items-center gap-2 hover:bg-gray-50">
          <Calendar size={18} />
          <span>Browse events</span>
        </Link>
        <Link to="/ministries" className="card flex items-center gap-2 hover:bg-gray-50">
          <Users size={18} />
          <span>Browse ministries</span>
        </Link>
      </div>

      <button
        onClick={() => logout()}
        className="btn-secondary w-full flex items-center justify-center gap-2"
      >
        <LogOut size={16} /> Sign out
      </button>
    </div>
  )
}
