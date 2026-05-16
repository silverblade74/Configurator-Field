import { useState, useEffect, useRef, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../components/ToastProvider'
import { useEventRealtime } from '../hooks/useEventRealtime'
import {
  getEvent, getAllUsers,
  checkIn, checkOut, adminAddVolunteer, releaseVolunteer,
  assignDepartment, createAndCheckInVolunteer,
} from '../services/firestore'
import KioskVolunteerRow from '../components/KioskVolunteerRow'
import KioskQuickAdd from '../components/KioskQuickAdd'
import KioskDepartmentFill from '../components/KioskDepartmentFill'
import { X, Search, Users, UserCheck, ToggleLeft, ToggleRight } from 'lucide-react'

export default function KioskMode() {
  const { eventId } = useParams()
  const navigate = useNavigate()
  const { userProfile } = useAuth()
  const toast = useToast()
  const searchRef = useRef(null)

  const [event, setEvent] = useState(null)
  const [allUsers, setAllUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [batchMode, setBatchMode] = useState(false)
  const [batchCount, setBatchCount] = useState(0)
  const [showQuickAdd, setShowQuickAdd] = useState(false)

  // Real-time signups listener
  const { data: signups } = useEventRealtime(eventId)

  useEffect(() => {
    loadData()
  }, [eventId])

  async function loadData() {
    try {
      const [eventData, usersData] = await Promise.all([
        getEvent(eventId),
        getAllUsers(),
      ])
      setEvent(eventData)
      setAllUsers(usersData)
    } catch (err) {
      console.error('Kiosk load error:', err)
      toast.error('Failed to load event data')
    }
    setLoading(false)
  }

  // Search: match against signups first, then all users not yet signed up
  const signupUserIds = new Set(signups.map((s) => s.userId))
  const query = searchQuery.toLowerCase().trim()

  const filteredSignups = useMemo(() => {
    if (!query) return signups
    return signups.filter((s) =>
      (s.userName || '').toLowerCase().includes(query)
    )
  }, [signups, query])

  const availableUsers = useMemo(() => {
    if (query.length < 2) return []
    return allUsers.filter((u) =>
      !signupUserIds.has(u.id) &&
      (u.displayName || '').toLowerCase().includes(query)
    ).slice(0, 5)
  }, [allUsers, signupUserIds, query])

  const sortedSignups = useMemo(() => {
    const order = { checked_in: 0, signed_up: 1, checked_out: 2, released: 3, no_show: 4 }
    return [...filteredSignups].sort((a, b) => (order[a.status] || 5) - (order[b.status] || 5))
  }, [filteredSignups])

  // Stats
  const checkedIn = signups.filter((s) => s.status === 'checked_in').length
  const total = signups.length

  // Handlers
  async function handleCheckIn(signupId) {
    setActionLoading(signupId)
    try {
      await checkIn(signupId)
      toast.success('Checked in!')
    } catch (err) { toast.error('Check-in failed') }
    setActionLoading(null)
  }

  async function handleCheckOut(signupId, userId) {
    setActionLoading(signupId)
    try {
      await checkOut(signupId, userId)
      toast.success('Checked out!')
    } catch (err) { toast.error('Check-out failed') }
    setActionLoading(null)
  }

  async function handleRelease(signupId) {
    setActionLoading(signupId)
    try {
      await releaseVolunteer(signupId)
      toast.info('Volunteer released')
    } catch (err) { toast.error('Release failed') }
    setActionLoading(null)
  }

  async function handleDeptChange(signupId, dept) {
    await assignDepartment(signupId, dept)
  }

  async function handleAddExisting(userId, displayName) {
    try {
      await adminAddVolunteer(eventId, userId, displayName)
      setSearchQuery('')
      toast.success(`${displayName} checked in!`)
      searchRef.current?.focus()
    } catch (err) { toast.error(err.message) }
  }

  async function handleQuickAdd({ displayName, phone, email, department }) {
    try {
      await createAndCheckInVolunteer(eventId, { displayName, phone, email, department })
      // Refresh allUsers since a new user doc was created
      const usersData = await getAllUsers()
      setAllUsers(usersData)
      setBatchCount((c) => c + 1)
      toast.success(`${displayName} added & checked in!`)
      if (!batchMode) {
        setShowQuickAdd(false)
        setSearchQuery('')
      }
    } catch (err) { toast.error('Failed to add volunteer') }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (!event) {
    return (
      <div className="fixed inset-0 bg-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl font-semibold text-gray-700">Event not found</p>
          <button onClick={() => navigate('/admin')} className="btn-primary mt-4">Back to Admin</button>
        </div>
      </div>
    )
  }

  const hasNoExactMatch = query.length >= 2 && availableUsers.length === 0 &&
    !signups.some((s) => (s.userName || '').toLowerCase() === query)

  return (
    <div className="fixed inset-0 bg-gray-50 flex flex-col">
      {/* Top Bar */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shrink-0">
        <div className="min-w-0">
          <h1 className="font-bold text-lg truncate">{event.title}</h1>
          <p className="text-xs text-gray-500">
            {event.date?.toDate().toLocaleDateString('en-US', {
              weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
            })}
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-center">
            <p className="text-2xl font-bold text-primary-600">{checkedIn}</p>
            <p className="text-xs text-gray-400">{total} total</p>
          </div>
          <button
            onClick={() => { setBatchMode(!batchMode); setBatchCount(0) }}
            className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${batchMode ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}
            title="Batch mode: keep quick-add form open after each add"
          >
            {batchMode ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
            <span className="hidden sm:inline">Batch</span>
          </button>
          <button
            onClick={() => navigate('/admin')}
            className="p-2 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100"
          >
            <X size={22} />
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 shrink-0">
        <div className="relative">
          <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            ref={searchRef}
            type="text"
            className="w-full pl-12 pr-4 py-3 text-lg border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:ring-2 focus:ring-primary-200 outline-none transition-colors"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search volunteers or type a new name..."
            autoFocus
          />
          {searchQuery && (
            <button
              onClick={() => { setSearchQuery(''); searchRef.current?.focus() }}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={20} />
            </button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {/* Available users not yet in event */}
        {availableUsers.length > 0 && (
          <div className="space-y-1 mb-3">
            <p className="text-xs font-medium text-gray-400 uppercase">Add to event</p>
            {availableUsers.map((user) => (
              <button
                key={user.id}
                onClick={() => handleAddExisting(user.id, user.displayName)}
                className="w-full flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-xl hover:bg-blue-100 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-200 flex items-center justify-center text-sm font-bold text-blue-700">
                    {user.displayName?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                  <div className="text-left">
                    <p className="font-semibold">{user.displayName}</p>
                    {user.managed && <span className="text-xs text-gray-400">no account</span>}
                  </div>
                </div>
                <span className="btn-kiosk !py-1.5 !px-3 !text-sm !min-h-0">+ Check In</span>
              </button>
            ))}
          </div>
        )}

        {/* New person prompt */}
        {hasNoExactMatch && !showQuickAdd && (
          <button
            onClick={() => setShowQuickAdd(true)}
            className="w-full p-4 bg-blue-50 border-2 border-dashed border-blue-300 rounded-xl text-blue-700 font-semibold text-center hover:bg-blue-100 transition-colors"
          >
            + New Volunteer: "{searchQuery}"
          </button>
        )}

        {/* Quick Add Form */}
        {(showQuickAdd || batchMode) && (
          <KioskQuickAdd
            defaultName={showQuickAdd ? searchQuery : ''}
            onAdd={handleQuickAdd}
            batchMode={batchMode}
            batchCount={batchCount}
          />
        )}

        {/* Signup List */}
        {sortedSignups.length === 0 && !query ? (
          <div className="text-center py-12">
            <Users size={48} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-400 text-lg">No volunteers yet</p>
            <p className="text-gray-300 text-sm">Search for someone or tap Batch mode to start adding</p>
          </div>
        ) : (
          <>
            {query && <p className="text-xs font-medium text-gray-400 uppercase">In this event</p>}
            {sortedSignups.map((signup) => (
              <KioskVolunteerRow
                key={signup.id}
                signup={signup}
                onCheckIn={handleCheckIn}
                onCheckOut={handleCheckOut}
                onRelease={handleRelease}
                onDepartmentChange={handleDeptChange}
                loading={actionLoading === signup.id}
              />
            ))}
          </>
        )}
      </div>

      {/* Bottom Department Bar */}
      <div className="bg-white border-t border-gray-200 px-4 py-3 shrink-0">
        <KioskDepartmentFill signups={signups} />
        {signups.length > 0 && (
          <div className="flex items-center justify-between mt-2 text-xs text-gray-400">
            <span>
              <UserCheck size={12} className="inline mr-1" />
              {checkedIn} checked in · {signups.filter((s) => s.status === 'checked_out').length} done · {signups.filter((s) => s.status === 'signed_up').length} pending
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
