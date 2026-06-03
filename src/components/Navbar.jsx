import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useBranding } from '../contexts/BrandingContext'
import { useDarkMode } from '../hooks/useDarkMode'
import {
  Menu,
  X,
  LogOut,
  User,
  LayoutDashboard,
  Calendar,
  Users,
  Trophy,
  Award,
  ClipboardList,
  Clock,
  History,
  FileText,
  Moon,
  Sun,
} from 'lucide-react'

export default function Navbar() {
  const {
    currentUser,
    userProfile,
    isApproved,
    isAdmin,
    isLeader,
    isPending,
    isRejected,
    logout,
  } = useAuth()
  const { churchName } = useBranding()
  const { darkMode, toggleDarkMode } = useDarkMode()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  const navLinks = []
  if (isApproved) navLinks.push({ to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard })
  navLinks.push({ to: '/events', label: 'Events', icon: Calendar })
  navLinks.push({ to: '/ministries', label: 'Ministries', icon: Users })
  navLinks.push({ to: '/claim-profile', label: 'Claim Profile', icon: User })
  if (isApproved) {
    navLinks.push({ to: '/leaderboard', label: 'Leaderboard', icon: Trophy })
    navLinks.push({ to: '/badges', label: 'Badges', icon: Award })
    navLinks.push({ to: '/history', label: 'My History', icon: History })
  }
  if (isPending || isRejected) {
    navLinks.unshift({
      to: '/pending-approval',
      label: isRejected ? 'Account not approved' : 'Pending review',
      icon: Clock,
    })
  }
  if (isAdmin || isLeader) navLinks.push({ to: '/leaders', label: 'Leaders', icon: ClipboardList })
  if (isAdmin) {
    navLinks.push({ to: '/admin', label: 'Admin', icon: LayoutDashboard })
    navLinks.push({ to: '/reports', label: 'Reports', icon: FileText })
  }

  const isActive = (path) => location.pathname === path

  return (
    <nav className="sticky top-0 z-50 border-b border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 justify-between">
          <div className="flex items-center">
            <Link to={isApproved ? '/dashboard' : '/pending-approval'} className="flex items-center space-x-2">
              <span className="text-2xl">&#9962;</span>
              <span className="hidden text-lg font-bold text-primary-700 dark:text-primary-400 sm:block">
                {churchName || 'VolunteerHub'}
              </span>
            </Link>
            {currentUser && (
              <div className="ml-8 hidden space-x-1 md:flex">
                {navLinks.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={`flex items-center space-x-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${isActive(link.to) ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'}`}
                  >
                    <link.icon size={16} />
                    <span>{link.label}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center space-x-3">
            {/* Dark mode toggle */}
            <button
              onClick={toggleDarkMode}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            {currentUser ? (
              <>
                <Link to="/profile" className="hidden items-center space-x-2 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white sm:flex">
                  <User size={16} />
                  <span>{userProfile?.displayName || currentUser.email}</span>
                </Link>
                <button onClick={handleLogout} className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200" aria-label="Log out">
                  <LogOut size={18} />
                </button>
                <button className="p-2 md:hidden" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Open navigation">
                  {mobileOpen ? <X size={20} /> : <Menu size={20} />}
                </button>
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
        <div className="border-t border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 md:hidden">
          <div className="space-y-1 px-4 py-3">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center space-x-2 rounded-lg px-3 py-2 text-sm font-medium ${isActive(link.to) ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'}`}
              >
                <link.icon size={16} />
                <span>{link.label}</span>
              </Link>
            ))}
            <Link to="/profile" onClick={() => setMobileOpen(false)} className="flex items-center space-x-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700">
              <User size={16} />
              <span>Profile</span>
            </Link>
          </div>
        </div>
      )}
    </nav>
  )
}
