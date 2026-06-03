import { Link } from 'react-router-dom'
import Notice from '../components/Notice'
import { useAuth } from '../contexts/AuthContext'

export default function PendingApproval() {
  const { userProfile, isRejected, logout } = useAuth()

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Account Review</h1>
        <p className="mt-1 text-sm text-gray-500">
          {userProfile?.displayName || userProfile?.email || 'Your account'} is not approved for volunteer signups yet.
        </p>
      </div>

      {isRejected ? (
        <Notice type="error" title="Account not approved">
          {userProfile?.approvalNote || 'Please contact an admin for next steps.'}
        </Notice>
      ) : (
        <Notice type="info" title="Pending admin approval">
          An admin will review your account. You can browse ministries and events while you wait.
        </Notice>
      )}

      <div className="flex flex-wrap gap-2">
        <Link className="btn-secondary" to="/events">Browse Events</Link>
        <Link className="btn-secondary" to="/ministries">Browse Ministries</Link>
        <button className="btn-primary" onClick={logout}>Sign Out</button>
      </div>
    </div>
  )
}
