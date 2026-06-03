import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function ProtectedRoute({ children, requiredRole, requireApproved = false }) {
  const { currentUser, loading, role, isApproved, isRejected } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary-600" />
      </div>
    )
  }

  if (!currentUser) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (requiredRole) {
    const allowed = Array.isArray(requiredRole) ? requiredRole : [requiredRole]
    if (!allowed.includes(role)) return <Navigate to="/dashboard" replace />
  }

  if (requireApproved && !isApproved) {
    return <Navigate to={isRejected ? '/profile' : '/pending-approval'} replace />
  }

  return children
}
