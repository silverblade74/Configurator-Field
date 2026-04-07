import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Menu, X, LogOut, User, LayoutDashboard, Calendar, Users, Trophy, Award, ClipboardList } from 'lucide-react'

export default function Navbar() {
  const { currentUser, userProfile, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)

  const isAdmin = userProfile?.role === 'admin'
  const isLeader = userProfile?.role === 'ministry_leader'

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  const navLinks = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/events', label: 'Events', icon: Calendar },
    { to: '/ministries', label: 'Ministries', icon: Users },
    { to: '/leaderboard', label: 'Leaderboard', icon: Trophy },
    { to: '/badges', label: 'Badges', icon: Award },
  ]

  if (isAdmin || isLeader) {
    navLinks.push({ to: '/leaders', label: 'Leaders', icon: ClipboardList })
  }
  if (isAdmin) {
    navLinks.push({ to: '/admin', label: 'Admin', icon: LayoutDashboard })
  }

  const isActive = (path) => location.pathname === path

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link to="/dashboard" className="flex items-center space-x-2">
              <span className="text-2xl">\u26EA</span>
              <span className="font-bold text-lg text-primary-700 hidden sm:block">VolunteerHub</span>
            </Link>
            {currentUser && (
              <div className="hidden md:flex ml-8 space-x-1">
                {navLinks.map((link) => (
                  <Link key={link.to} to={link.to} className={`flex items-center space-x-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${isActive(link.to) ? 'bg-primary-50 text-primary-700' : 'text-gray-600 hover:bg-gray-100'}`}>
                    <link.icon size={16} /><span>{link.label}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center space-x-3">
            {currentUser ? (
              <>
                <Link to="/profile" className="hidden sm:flex items-center space-x-2 text-sm text-gray-600 hover:text-gray-900">
                  <User size={16} /><span>{userProfile?.displayName || currentUser.email}</span>
                </Link>
                <button onClick={handleLogout} className="text-gray-500 hover:text-gray-700 p-2"><LogOut size={18} /></button>
                <button className="md:hidden p-2" onClick={() => setMobileOpen(!mobileOpen)}>{mobileOpen ? <X size={20} /> : <Menu size={20} />}</button>
              </>
            ) : (
              <div className="flex space-x-2">
                <Link to="/login" className="btn-secondary text-sm">Log In</Link>
                <Link to="/register" className="btn-primary text-sm">Sign Up</Link>
              </div>
            )}
          </div>
        </div>
      </div>
      {mobileOpen && currentUser && (
        <div className="md:hidden border-t border-gray-200 bg-white">
          <div className="px-4 py-3 space-y-1">
            {navLinks.map((link) => (
              <Link key={link.to} to={link.to} onClick={() => setMobileOpen(false)} className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium ${isActive(link.to) ? 'bg-primary-50 text-primary-700' : 'text-gray-600 hover:bg-gray-100'}`}>
                <link.icon size={16} /><span>{link.label}</span>
              </Link>
            ))}
            <Link to="/profile" onClick={() => setMobileOpen(false)} className="flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100">
              <User size={16} /><span>Profile</span>
            </Link>
          </div>
        </div>
      )}
    </nav>
  )
}
