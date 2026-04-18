import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { getEvents, getMinistries, signUpForEvent, getUserSignups, cancelSignup } from '../services/firestore'
import EmptyState from '../components/EmptyState'
import Notice from '../components/Notice'
import { Calendar, MapPin, Users, Clock, Check, X } from 'lucide-react'

export default function Events() {
  const { userProfile, isApproved } = useAuth()
  const [events, setEvents] = useState([])
  const [ministries, setMinistries] = useState([])
  const [userSignups, setUserSignups] = useState([])
  const [filter, setFilter] = useState('upcoming')
  const [ministryFilter, setMinistryFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(null)
  const [message, setMessage] = useState(null)

  useEffect(() => { loadData() }, [userProfile])

  async function loadData() {
    try {
      const [eventsData, ministriesData, signupsData] = await Promise.all([
        getEvents(), getMinistries(), userProfile ? getUserSignups(userProfile.id) : [],
      ])
      setEvents(eventsData)
      setMinistries(ministriesData)
      setUserSignups(signupsData)
    } catch (err) { console.error('Error loading events:', err) }
    setLoading(false)
  }

  async function handleSignUp(eventId) {
    setActionLoading(eventId)
    setMessage(null)
    try {
      await signUpForEvent(eventId, userProfile.id, userProfile.displayName)
      setMessage({ type: 'success', text: 'Signed up.' })
      await loadData()
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to sign up.' })
    }
    setActionLoading(null)
  }

  async function handleCancel(eventId) {
    const signup = userSignups.find((s) => s.eventId === eventId)
    if (!signup) return
    setActionLoading(eventId)
    setMessage(null)
    try {
      await cancelSignup(signup.id, eventId)
      setMessage({ type: 'success', text: 'Signup cancelled.' })
      await loadData()
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to cancel signup.' })
    }
    setActionLoading(null)
  }

  const now = new Date()
  const filteredEvents = events
    .filter((e) => {
      const eventDate = e.date?.toDate()
      if (filter === 'upcoming') return eventDate > now
      if (filter === 'past') return eventDate <= now
      return true
    })
    .filter((e) => !ministryFilter || e.ministryId === ministryFilter)

  function isSignedUp(eventId) {
    return userSignups.some((s) => s.eventId === eventId && s.status !== 'checked_out')
  }

  function getMinistryName(ministryId) {
    return ministries.find((m) => m.id === ministryId)?.name || 'General'
  }

  if (loading) {
    return (<div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div></div>)
  }

  return (
    <div className="space-y-6">
      {message && <Notice type={message.type}>{message.text}</Notice>}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold">Events</h1>
        <div className="flex flex-wrap gap-2">
          <select className="input w-auto" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="upcoming">Upcoming</option>
            <option value="past">Past</option>
            <option value="all">All Events</option>
          </select>
          <select className="input w-auto" value={ministryFilter} onChange={(e) => setMinistryFilter(e.target.value)}>
            <option value="">All Ministries</option>
            {ministries.map((m) => (<option key={m.id} value={m.id}>{m.name}</option>))}
          </select>
        </div>
      </div>

      {filteredEvents.length === 0 ? (
        <EmptyState icon={Calendar} title="No events found" description={filter === 'upcoming' ? 'Check back soon for new events!' : 'No past events to show.'} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredEvents.map((event) => {
            const eventDate = event.date?.toDate()
            const isPast = eventDate <= now
            const signed = isSignedUp(event.id)

            return (
              <div key={event.id} className={`card ${isPast ? 'opacity-75' : ''}`}>
                <div className="flex items-start justify-between mb-3">
                  <span className="badge bg-primary-100 text-primary-700">{getMinistryName(event.ministryId)}</span>
                  {signed && (<span className="badge bg-green-100 text-green-700 flex items-center space-x-1"><Check size={12} /><span>Signed Up</span></span>)}
                </div>

                <h3 className="font-semibold text-lg">{event.title}</h3>
                {event.description && (<p className="text-sm text-gray-500 mt-1 line-clamp-2">{event.description}</p>)}

                <div className="mt-4 space-y-2 text-sm text-gray-600">
                  <div className="flex items-center space-x-2"><Calendar size={14} /><span>{eventDate?.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</span></div>
                  <div className="flex items-center space-x-2"><Clock size={14} /><span>{eventDate?.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}{event.durationHours && ` (${event.durationHours}h)`}</span></div>
                  {event.location && (<div className="flex items-center space-x-2"><MapPin size={14} /><span>{event.location}</span></div>)}
                  <div className="flex items-center space-x-2"><Users size={14} /><span>{event.signupCount || 0}{event.maxVolunteers ? ` / ${event.maxVolunteers}` : ''} volunteers</span></div>
                </div>

                {!isPast && (
                  <div className="mt-4">
                    {!isApproved ? (
                      <button className="btn-secondary w-full" disabled>
                        Approval required
                      </button>
                    ) : signed ? (
                      <button onClick={() => handleCancel(event.id)} disabled={actionLoading === event.id} className="btn-secondary w-full flex items-center justify-center space-x-1">
                        <X size={14} /><span>{actionLoading === event.id ? 'Cancelling...' : 'Cancel Signup'}</span>
                      </button>
                    ) : (
                      <button onClick={() => handleSignUp(event.id)} disabled={actionLoading === event.id || (event.maxVolunteers && event.signupCount >= event.maxVolunteers)} className="btn-primary w-full">
                        {actionLoading === event.id ? 'Signing up...' : 'Sign Up'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
