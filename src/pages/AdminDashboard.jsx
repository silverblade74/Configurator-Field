import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import {
  getAllUsers, getEvents, getMinistries, getServiceHoursSummary,
  createEvent, createMinistry, updateEvent, deleteEvent,
  updateMinistry, deleteMinistry, updateUserRole, getEventSignups, checkIn, checkOut,
} from '../services/firestore'
import { formatHours } from '../utils/gamification'
import StatCard from '../components/StatCard'
import { Users, Calendar, Clock, Award, Plus, Trash2, Edit3, ChevronDown, ChevronUp, UserCheck, UserX, BarChart3 } from 'lucide-react'
import { Timestamp } from 'firebase/firestore'

export default function AdminDashboard() {
  const { userProfile } = useAuth()
  const [tab, setTab] = useState('overview')
  const [users, setUsers] = useState([])
  const [events, setEvents] = useState([])
  const [ministries, setMinistries] = useState([])
  const [serviceHours, setServiceHours] = useState([])
  const [loading, setLoading] = useState(true)
  const [showEventForm, setShowEventForm] = useState(false)
  const [showMinistryForm, setShowMinistryForm] = useState(false)
  const [eventForm, setEventForm] = useState({ title: '', description: '', date: '', location: '', ministryId: '', maxVolunteers: '', durationHours: '' })
  const [ministryForm, setMinistryForm] = useState({ name: '', description: '', leaderName: '', contactEmail: '' })
  const [checkInEventId, setCheckInEventId] = useState(null)
  const [eventSignups, setEventSignups] = useState([])
  const [checkInLoading, setCheckInLoading] = useState(null)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    try {
      const [usersData, eventsData, ministriesData, hoursData] = await Promise.all([
        getAllUsers(), getEvents(), getMinistries(), getServiceHoursSummary(),
      ])
      setUsers(usersData); setEvents(eventsData); setMinistries(ministriesData); setServiceHours(hoursData)
    } catch (err) { console.error('Error loading admin data:', err) }
    setLoading(false)
  }

  const totalVolunteers = users.filter((u) => u.role === 'volunteer').length
  const totalHours = users.reduce((sum, u) => sum + (u.totalHours || 0), 0)
  const upcomingEvents = events.filter((e) => e.date?.toDate() > new Date()).length

  async function handleCreateEvent(e) {
    e.preventDefault()
    try {
      await createEvent({ ...eventForm, date: Timestamp.fromDate(new Date(eventForm.date)), maxVolunteers: eventForm.maxVolunteers ? Number(eventForm.maxVolunteers) : null, durationHours: eventForm.durationHours ? Number(eventForm.durationHours) : null })
      setShowEventForm(false)
      setEventForm({ title: '', description: '', date: '', location: '', ministryId: '', maxVolunteers: '', durationHours: '' })
      await loadData()
    } catch (err) { alert('Failed to create event') }
  }

  async function handleDeleteEvent(id) { if (!confirm('Delete this event?')) return; await deleteEvent(id); await loadData() }

  async function handleCreateMinistry(e) {
    e.preventDefault()
    try {
      await createMinistry(ministryForm)
      setShowMinistryForm(false)
      setMinistryForm({ name: '', description: '', leaderName: '', contactEmail: '' })
      await loadData()
    } catch (err) { alert('Failed to create ministry') }
  }

  async function handleDeleteMinistry(id) { if (!confirm('Delete this ministry?')) return; await deleteMinistry(id); await loadData() }
  async function handleRoleChange(userId, newRole) { await updateUserRole(userId, newRole); await loadData() }

  async function openCheckIn(eventId) { setCheckInEventId(eventId); const signups = await getEventSignups(eventId); setEventSignups(signups) }
  async function handleCheckIn(signupId) { setCheckInLoading(signupId); await checkIn(signupId); const signups = await getEventSignups(checkInEventId); setEventSignups(signups); setCheckInLoading(null) }
  async function handleCheckOut(signupId, userId) { setCheckInLoading(signupId); await checkOut(signupId, userId); const signups = await getEventSignups(checkInEventId); setEventSignups(signups); setCheckInLoading(null); await loadData() }

  function getMinistryName(id) { return ministries.find((m) => m.id === id)?.name || 'General' }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'events', label: 'Events', icon: Calendar },
    { id: 'ministries', label: 'Ministries', icon: Users },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'checkin', label: 'Check-In', icon: UserCheck },
  ]

  if (loading) return (<div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div></div>)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Admin Dashboard</h1>

      <div className="flex flex-wrap gap-1 border-b border-gray-200 pb-0">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center space-x-1 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t.id ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            <t.icon size={16} /><span>{t.label}</span>
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="Total Volunteers" value={totalVolunteers} icon={Users} color="primary" />
            <StatCard title="Total Hours" value={formatHours(totalHours)} icon={Clock} color="green" />
            <StatCard title="Upcoming Events" value={upcomingEvents} icon={Calendar} color="orange" />
            <StatCard title="Ministries" value={ministries.length} icon={Award} color="purple" />
          </div>
          <div className="card">
            <h2 className="font-semibold text-lg mb-4">Top Volunteers</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50"><tr><th className="text-left px-3 py-2">Name</th><th className="text-right px-3 py-2">Hours</th><th className="text-right px-3 py-2">Points</th><th className="text-right px-3 py-2">Badges</th></tr></thead>
                <tbody className="divide-y">
                  {users.sort((a, b) => (b.totalHours || 0) - (a.totalHours || 0)).slice(0, 10).map((u) => (
                    <tr key={u.id}><td className="px-3 py-2">{u.displayName || u.email}</td><td className="px-3 py-2 text-right">{formatHours(u.totalHours || 0)}</td><td className="px-3 py-2 text-right">{u.totalPoints || 0}</td><td className="px-3 py-2 text-right">{(u.badges || []).length}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'events' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="font-semibold text-lg">Manage Events</h2>
            <button onClick={() => setShowEventForm(!showEventForm)} className="btn-primary flex items-center space-x-1"><Plus size={16} /><span>New Event</span></button>
          </div>
          {showEventForm && (
            <form onSubmit={handleCreateEvent} className="card space-y-4">
              <h3 className="font-semibold">Create Event</h3>
              <div className="grid sm:grid-cols-2 gap-4">
                <div><label className="label">Title *</label><input className="input" required value={eventForm.title} onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })} /></div>
                <div><label className="label">Date & Time *</label><input type="datetime-local" className="input" required value={eventForm.date} onChange={(e) => setEventForm({ ...eventForm, date: e.target.value })} /></div>
                <div><label className="label">Location</label><input className="input" value={eventForm.location} onChange={(e) => setEventForm({ ...eventForm, location: e.target.value })} /></div>
                <div><label className="label">Ministry</label><select className="input" value={eventForm.ministryId} onChange={(e) => setEventForm({ ...eventForm, ministryId: e.target.value })}><option value="">General</option>{ministries.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></div>
                <div><label className="label">Max Volunteers</label><input type="number" className="input" value={eventForm.maxVolunteers} onChange={(e) => setEventForm({ ...eventForm, maxVolunteers: e.target.value })} /></div>
                <div><label className="label">Duration (hours)</label><input type="number" step="0.5" className="input" value={eventForm.durationHours} onChange={(e) => setEventForm({ ...eventForm, durationHours: e.target.value })} /></div>
              </div>
              <div><label className="label">Description</label><textarea className="input" rows={3} value={eventForm.description} onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })} /></div>
              <div className="flex space-x-2"><button type="submit" className="btn-primary">Create Event</button><button type="button" onClick={() => setShowEventForm(false)} className="btn-secondary">Cancel</button></div>
            </form>
          )}
          <div className="card p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b"><tr><th className="text-left px-4 py-3">Event</th><th className="text-left px-4 py-3 hidden sm:table-cell">Date</th><th className="text-left px-4 py-3 hidden md:table-cell">Ministry</th><th className="text-right px-4 py-3">Signups</th><th className="text-right px-4 py-3">Actions</th></tr></thead>
              <tbody className="divide-y">
                {events.map((event) => (
                  <tr key={event.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{event.title}</td>
                    <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">{event.date?.toDate().toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{getMinistryName(event.ministryId)}</td>
                    <td className="px-4 py-3 text-right">{event.signupCount || 0}</td>
                    <td className="px-4 py-3 text-right"><button onClick={() => handleDeleteEvent(event.id)} className="text-red-500 hover:text-red-700 p-1"><Trash2 size={14} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'ministries' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="font-semibold text-lg">Manage Ministries</h2>
            <button onClick={() => setShowMinistryForm(!showMinistryForm)} className="btn-primary flex items-center space-x-1"><Plus size={16} /><span>New Ministry</span></button>
          </div>
          {showMinistryForm && (
            <form onSubmit={handleCreateMinistry} className="card space-y-4">
              <h3 className="font-semibold">Create Ministry</h3>
              <div className="grid sm:grid-cols-2 gap-4">
                <div><label className="label">Name *</label><input className="input" required value={ministryForm.name} onChange={(e) => setMinistryForm({ ...ministryForm, name: e.target.value })} /></div>
                <div><label className="label">Leader Name</label><input className="input" value={ministryForm.leaderName} onChange={(e) => setMinistryForm({ ...ministryForm, leaderName: e.target.value })} /></div>
                <div className="sm:col-span-2"><label className="label">Description</label><textarea className="input" rows={2} value={ministryForm.description} onChange={(e) => setMinistryForm({ ...ministryForm, description: e.target.value })} /></div>
                <div><label className="label">Contact Email</label><input type="email" className="input" value={ministryForm.contactEmail} onChange={(e) => setMinistryForm({ ...ministryForm, contactEmail: e.target.value })} /></div>
              </div>
              <div className="flex space-x-2"><button type="submit" className="btn-primary">Create Ministry</button><button type="button" onClick={() => setShowMinistryForm(false)} className="btn-secondary">Cancel</button></div>
            </form>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            {ministries.map((m) => (
              <div key={m.id} className="card flex justify-between items-start">
                <div><h3 className="font-semibold">{m.name}</h3>{m.description && <p className="text-sm text-gray-500 mt-1">{m.description}</p>}<p className="text-xs text-gray-400 mt-1">{m.leaderName && `Led by ${m.leaderName}`}{m.memberCount ? ` \u00B7 ${m.memberCount} members` : ''}</p></div>
                <button onClick={() => handleDeleteMinistry(m.id)} className="text-red-500 hover:text-red-700 p-1"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'users' && (
        <div className="space-y-4">
          <h2 className="font-semibold text-lg">Manage Users ({users.length})</h2>
          <div className="card p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b"><tr><th className="text-left px-4 py-3">Name</th><th className="text-left px-4 py-3 hidden sm:table-cell">Email</th><th className="text-right px-4 py-3">Hours</th><th className="text-left px-4 py-3">Role</th></tr></thead>
              <tbody className="divide-y">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{u.displayName || 'Unknown'}</td>
                    <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">{u.email}</td>
                    <td className="px-4 py-3 text-right">{formatHours(u.totalHours || 0)}</td>
                    <td className="px-4 py-3"><select className="input py-1 text-xs w-auto" value={u.role} onChange={(e) => handleRoleChange(u.id, e.target.value)}><option value="volunteer">Volunteer</option><option value="ministry_leader">Ministry Leader</option><option value="admin">Admin</option></select></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'checkin' && (
        <div className="space-y-4">
          <h2 className="font-semibold text-lg">Event Check-In</h2>
          <p className="text-sm text-gray-500">Select an event to manage check-ins</p>
          <div className="grid gap-3 md:grid-cols-2">
            {events.filter((e) => { const d = e.date?.toDate(); const now = new Date(); return d && d >= new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000) }).map((event) => (
              <button key={event.id} onClick={() => openCheckIn(event.id)} className={`card text-left hover:shadow-md transition-shadow ${checkInEventId === event.id ? 'ring-2 ring-primary-500' : ''}`}>
                <h3 className="font-semibold">{event.title}</h3>
                <p className="text-sm text-gray-500">{event.date?.toDate().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
                <p className="text-xs text-gray-400 mt-1">{event.signupCount || 0} signups</p>
              </button>
            ))}
          </div>
          {checkInEventId && (
            <div className="card">
              <h3 className="font-semibold text-lg mb-4">Signups</h3>
              {eventSignups.length === 0 ? (<p className="text-gray-400 text-sm text-center py-4">No signups for this event</p>) : (
                <div className="space-y-2">
                  {eventSignups.map((signup) => (
                    <div key={signup.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div><p className="font-medium text-sm">{signup.userName}</p><p className="text-xs text-gray-400 capitalize">{signup.status.replace('_', ' ')}</p></div>
                      <div className="flex space-x-2">
                        {signup.status === 'signed_up' && (<button onClick={() => handleCheckIn(signup.id)} disabled={checkInLoading === signup.id} className="btn-primary text-xs py-1 px-3 flex items-center space-x-1"><UserCheck size={12} /><span>{checkInLoading === signup.id ? '...' : 'Check In'}</span></button>)}
                        {signup.status === 'checked_in' && (<button onClick={() => handleCheckOut(signup.id, signup.userId)} disabled={checkInLoading === signup.id} className="btn-secondary text-xs py-1 px-3 flex items-center space-x-1"><UserX size={12} /><span>{checkInLoading === signup.id ? '...' : 'Check Out'}</span></button>)}
                        {signup.status === 'checked_out' && (<span className="text-xs text-green-600 font-medium">{formatHours(signup.hoursLogged)} logged</span>)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
