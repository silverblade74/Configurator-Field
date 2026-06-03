import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function ProtectedRoute({
  children,
  requiredRole,
  requireApproved = false,
  allowPending = false,
}) {
  const { currentUser, loading, role, approvalStatus, isApproved, isRejected } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary-600" />
      </div>
    )
  }

  if (!currentUser) {
    const redirect = `${location.pathname}${location.search}`
    return <Navigate to="/login" replace state={{ from: redirect }} />
  }

  if (requiredRole) {
    const allowed = Array.isArray(requiredRole) ? requiredRole : [requiredRole]
    if (!allowed.includes(role)) return <Navigate to="/dashboard" replace />
  }

  if (requireApproved && !isApproved) {
    return <Navigate to={isRejected ? '/profile' : '/pending-approval'} replace />
  }

  if (allowPending && approvalStatus === 'approved') {
    return <Navigate to="/dashboard" replace />
  }

  return children
}
