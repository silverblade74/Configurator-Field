import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function ProtectedRoute({ children, requiredRole, requireApproved }) {
  const { currentUser, userProfile, loading, isApproved, isRejected } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (!currentUser) return <Navigate to="/login" />

  if (requiredRole) {
    const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole]
    if (!roles.includes(userProfile?.role)) return <Navigate to="/dashboard" />
  }

  if (requireApproved && !isApproved) {
    return <Navigate to="/pending-approval" />
  }

  return children
}
