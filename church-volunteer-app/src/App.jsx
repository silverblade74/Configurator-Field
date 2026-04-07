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

export default function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

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
      </Route>

      {/* Redirect */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
