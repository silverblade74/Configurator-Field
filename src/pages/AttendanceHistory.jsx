import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../components/ToastProvider'
import { getAttendanceLogs, getEventsByIds, getUserProfile } from '../services/firestore'
import { formatHours } from '../utils/gamification'
import StatCard from '../components/StatCard'
import { Clock, Calendar, Star, History } from 'lucide-react'

export default function AttendanceHistory() {
  const { userId: paramUserId } = useParams()
  const { userProfile } = useAuth()
  const toast = useToast()
  const [logs, setLogs] = useState([])
  const [eventsMap, setEventsMap] = useState({})
  const [targetUser, setTargetUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // Determine whose history to show
  const isAdmin = userProfile?.role === 'admin'
  const targetId = paramUserId || userProfile?.uid || userProfile?.id

  useEffect(() => {
    async function loadHistory() {
      try {
        // Fetch the target user profile if viewing someone else's history
        if (paramUserId && paramUserId !== (userProfile?.uid || userProfile?.id)) {
          if (!isAdmin) {
            toast.error('You do not have permission to view this history')
            setLoading(false)
            return
          }
          const profile = await getUserProfile(paramUserId)
          setTargetUser(profile)
        } else {
          setTargetUser(userProfile)
        }

        const attendanceLogs = await getAttendanceLogs({ userId: targetId })
        setLogs(attendanceLogs)

        // Batch-fetch event details
        const eventIds = [...new Set(attendanceLogs.map((l) => l.eventId).filter(Boolean))]
        if (eventIds.length > 0) {
          const events = await getEventsByIds(eventIds)
          setEventsMap(events)
        }
      } catch (err) {
        console.error('Error loading attendance history:', err)
        toast.error('Failed to load attendance history')
      }
      setLoading(false)
    }
    if (targetId) loadHistory()
  }, [targetId])

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  // Summary stats
  const totalEvents = logs.length
  const totalHours = logs.reduce((sum, l) => sum + (l.hoursLogged || 0), 0)
  // Estimate points: 10 per hour (mirrors gamification engine base rate)
  const totalPoints = logs.reduce((sum, l) => sum + Math.floor((l.hoursLogged || 0) * 10), 0)
  const displayName = targetUser?.displayName || targetUser?.email || 'Volunteer'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <History size={24} />
          {paramUserId && paramUserId !== (userProfile?.uid || userProfile?.id)
            ? `${displayName}'s History`
            : 'My Attendance History'}
        </h1>
        {paramUserId && paramUserId !== (userProfile?.uid || userProfile?.id) && (
          <p className="text-sm text-gray-500 mt-1">Viewing as admin</p>
        )}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard title="Total Events" value={totalEvents} icon={Calendar} color="primary" />
        <StatCard title="Total Hours" value={formatHours(totalHours)} icon={Clock} color="green" />
        <StatCard title="Est. Points" value={totalPoints} icon={Star} color="orange" />
      </div>

      {/* Timeline */}
      {logs.length === 0 ? (
        <div className="card text-center py-8">
          <p className="text-gray-400">No attendance records yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {logs.map((log) => {
            const event = eventsMap[log.eventId]
            const checkInDate = log.checkedInAt
              ? (typeof log.checkedInAt.toDate === 'function' ? log.checkedInAt.toDate() : new Date(log.checkedInAt))
              : null
            const checkOutDate = log.checkedOutAt
              ? (typeof log.checkedOutAt.toDate === 'function' ? log.checkedOutAt.toDate() : new Date(log.checkedOutAt))
              : null
            const points = Math.floor((log.hoursLogged || 0) * 10)

            return (
              <div key={log.id} className="card p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium">{event?.title || 'Unknown Event'}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 mt-1">
                      {checkInDate && (
                        <span>
                          {checkInDate.toLocaleDateString('en-US', {
                            weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
                          })}
                        </span>
                      )}
                      {event?.ministryId && (
                        <span className="badge bg-primary-100 text-primary-700">{event.ministryId}</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400 mt-1">
                      {checkInDate && (
                        <span>In: {checkInDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
                      )}
                      {checkOutDate && (
                        <span>Out: {checkOutDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-lg font-bold">{formatHours(log.hoursLogged || 0)}</p>
                    <p className="text-xs text-green-600">+{points} pts</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
