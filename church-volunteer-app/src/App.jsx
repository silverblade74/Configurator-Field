import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Register from './pages/Register'
import VolunteerDashboard from './pages/VolunteerDashboard'
import Events from './pages/Events'
import Ministries from './pages/Ministries'
import Leaderboard from './pages/Leaderboard'
import Badges from './pages/Badges'
import Profile from './pages/Profile'
import AdminDashboard from './pages/AdminDashboard'
import LeaderDashboard from './pages/LeaderDashboard'
import KioskMode from './pages/KioskMode'
import ClaimProfile from './pages/ClaimProfile'
import Onboarding from './pages/Onboarding'
import Reports from './pages/Reports'
import AttendanceHistory from './pages/AttendanceHistory'

export default function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/claim/:token" element={<ClaimProfile />} />

      {/* Onboarding wizard: admin-only, full-screen */}
      <Route path="/onboarding" element={
        <ProtectedRoute requiredRole={['admin']}>
          <Onboarding />
        </ProtectedRoute>
      } />

      {/* Kiosk mode: full-screen, no layout wrapper */}
      <Route path="/kiosk/:eventId" element={
        <ProtectedRoute requiredRole={['admin']}>
          <KioskMode />
        </ProtectedRoute>
      } />

      {/* Protected routes */}
      <Route element={
        <ProtectedRoute>
          <Layout />
        </ProtectedRoute>
      }>
        <Route path="/dashboard" element={<VolunteerDashboard />} />
        <Route path="/events" element={<Events />} />
        <Route path="/ministries" element={<Ministries />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/badges" element={<Badges />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/leaders" element={
          <ProtectedRoute requiredRole={['admin', 'ministry_leader']}>
            <LeaderDashboard />
          </ProtectedRoute>
        } />
        <Route path="/admin" element={
          <ProtectedRoute requiredRole={['admin']}>
            <AdminDashboard />
          </ProtectedRoute>
        } />
        <Route path="/reports" element={
          <ProtectedRoute requiredRole={['admin']}>
            <Reports />
          </ProtectedRoute>
        } />
        <Route path="/history" element={<AttendanceHistory />} />
        <Route path="/history/:userId" element={<AttendanceHistory />} />
      </Route>

      {/* Redirect */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
