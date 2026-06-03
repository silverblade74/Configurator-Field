import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { getUserSignups, getEventsByIds, BADGE_DEFINITIONS } from '../services/firestore'
import { formatHours, getLevel, getNextMilestone } from '../utils/gamification'
import StatCard from '../components/StatCard'
import ErrorState from '../components/ErrorState'
import { Clock, Trophy, Flame, Star, Calendar, ArrowRight } from 'lucide-react'

export default function VolunteerDashboard() {
  const { userProfile } = useAuth()
  const [upcomingEvents, setUpcomingEvents] = useState([])
  const [recentActivity, setRecentActivity] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function loadData() {
      if (!userProfile) return
      try {
        const signups = await getUserSignups(userProfile.uid || userProfile.id)
        const eventIds = [...new Set(signups.map((s) => s.eventId).filter(Boolean))]
        const eventsMap = await getEventsByIds(eventIds)
        const eventsWithDetails = signups.map((signup) => ({ ...signup, event: eventsMap[signup.eventId] || null }))

        const now = new Date()
        setUpcomingEvents(eventsWithDetails.filter((s) => s.event && s.event.date?.toDate() > now && s.status === 'signed_up').sort((a, b) => a.event.date.toDate() - b.event.date.toDate()).slice(0, 5))
        setRecentActivity(eventsWithDetails.filter((s) => s.status === 'checked_out').sort((a, b) => (b.checkedOutAt?.toDate() || 0) - (a.checkedOutAt?.toDate() || 0)).slice(0, 5))
      } catch (err) {
        console.error('Error loading dashboard:', err)
        setError(err.message)
      }
      setLoading(false)
    }
    loadData()
  }, [userProfile])

  if (loading) return (<div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div></div>)
  if (error) return <ErrorState message={error} onRetry={() => window.location.reload()} />

  const level = getLevel(userProfile?.totalPoints || 0)
  const nextMilestone = getNextMilestone(userProfile?.totalHours || 0)
  const earnedBadges = BADGE_DEFINITIONS.filter((b) => (userProfile?.badges || []).includes(b.id))

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Welcome, {userProfile?.displayName || 'Volunteer'}!</h1>
          <p className="text-gray-500 mt-1">
            <span className={`font-medium ${level.color}`}>{level.name}</span> Level
            {nextMilestone && <span className="text-gray-400"> &middot; Next milestone: {nextMilestone}h</span>}
          </p>
        </div>
        <Link to="/events" className="btn-primary mt-3 sm:mt-0 inline-flex items-center space-x-1"><Calendar size={16} /><span>Browse Events</span></Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Hours" value={formatHours(userProfile?.totalHours || 0)} icon={Clock} color="primary" />
        <StatCard title="Total Points" value={userProfile?.totalPoints || 0} icon={Star} color="orange" />
        <StatCard title="Current Streak" value={`${userProfile?.streak || 0} weeks`} icon={Flame} color="red" />
        <StatCard title="Badges Earned" value={earnedBadges.length} subtitle={`of ${BADGE_DEFINITIONS.length}`} icon={Trophy} color="purple" />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-lg">Upcoming Events</h2>
            <Link to="/events" className="text-primary-600 text-sm hover:underline flex items-center">View all <ArrowRight size={14} className="ml-1" /></Link>
          </div>
          {upcomingEvents.length === 0 ? (
            <p className="text-gray-400 text-sm py-4 text-center">No upcoming events. <Link to="/events" className="text-primary-600 hover:underline">Sign up for one!</Link></p>
          ) : (
            <div className="space-y-3">
              {upcomingEvents.map((signup) => (
                <div key={signup.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-sm">{signup.event?.title}</p>
                    <p className="text-xs text-gray-500">{signup.event?.date?.toDate().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
                  </div>
                  <span className="badge bg-blue-100 text-blue-700">Signed Up</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h2 className="font-semibold text-lg mb-4">Recent Activity</h2>
          {recentActivity.length === 0 ? (
            <p className="text-gray-400 text-sm py-4 text-center">No activity yet. Start volunteering to see your history here!</p>
          ) : (
            <div className="space-y-3">
              {recentActivity.map((signup) => (
                <div key={signup.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-sm">{signup.event?.title}</p>
                    <p className="text-xs text-gray-500">{signup.checkedOutAt?.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{formatHours(signup.hoursLogged)}</p>
                    <p className="text-xs text-green-600">+{Math.floor(signup.hoursLogged * 10)} pts</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {earnedBadges.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-lg">Your Badges</h2>
            <Link to="/badges" className="text-primary-600 text-sm hover:underline flex items-center">View all <ArrowRight size={14} className="ml-1" /></Link>
          </div>
          <div className="flex flex-wrap gap-3">
            {earnedBadges.map((badge) => (
              <div key={badge.id} className="flex items-center space-x-2 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">
                <span className="text-xl">{badge.icon}</span>
                <div><p className="text-sm font-medium">{badge.name}</p><p className="text-xs text-gray-500">{badge.description}</p></div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
