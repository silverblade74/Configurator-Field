import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Register from './pages/Register'
import PendingApproval from './pages/PendingApproval'
import VolunteerDashboard from './pages/VolunteerDashboard'
import Events from './pages/Events'
import Ministries from './pages/Ministries'
import Leaderboard from './pages/Leaderboard'
import Badges from './pages/Badges'
import Profile from './pages/Profile'
import AdminDashboard from './pages/AdminDashboard'
import LeaderDashboard from './pages/LeaderDashboard'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route element={
        <ProtectedRoute>
          <Layout />
        </ProtectedRoute>
      }>
        <Route path="/pending-approval" element={
          <ProtectedRoute allowPending>
            <PendingApproval />
          </ProtectedRoute>
        } />
        <Route path="/dashboard" element={
          <ProtectedRoute requireApproved>
            <VolunteerDashboard />
          </ProtectedRoute>
        } />
        <Route path="/events" element={<Events />} />
        <Route path="/ministries" element={<Ministries />} />
        <Route path="/leaderboard" element={
          <ProtectedRoute requireApproved>
            <Leaderboard />
          </ProtectedRoute>
        } />
        <Route path="/badges" element={
          <ProtectedRoute requireApproved>
            <Badges />
          </ProtectedRoute>
        } />
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
      </Route>

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
