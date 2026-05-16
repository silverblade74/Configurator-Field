import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../components/ToastProvider'
import { useConfirm } from '../hooks/useConfirm'
import {
  getAllUsers, getEvents, getMinistries, getServiceHoursSummary,
  createEvent, createMinistry, deleteEvent, deleteMinistry,
  updateUserRole, getEventSignups, signUpForEvent, cancelSignup,
  checkIn, checkOut, adminAddVolunteer, releaseVolunteer, markNoShow,
  createManagedVolunteer, deleteVolunteer, assignDepartment, updateVolunteerProfile,
  generateClaimForVolunteer,
} from '../services/firestore'
import { formatHours } from '../utils/gamification'
import { DEPARTMENTS } from '../utils/departments'
import StatCard from '../components/StatCard'
import ClaimQRCode from '../components/ClaimQRCode'
import CSVImport from '../components/CSVImport'
import BulkInviteModal from '../components/BulkInviteModal'
import {
  Users, Calendar, Clock, Award, Plus, Trash2,
  UserCheck, UserX, BarChart3,
  Search, MinusCircle, XCircle, UserPlus, Link as LinkIcon, QrCode,
  Upload, Mail,
} from 'lucide-react'
import { Timestamp } from 'firebase/firestore'

export default function AdminDashboard() {
  const { userProfile } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const { confirm, ConfirmDialog } = useConfirm()
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
  const [showVolunteerForm, setShowVolunteerForm] = useState(false)
  const [volunteerForm, setVolunteerForm] = useState({ displayName: '', email: '', phone: '' })
  const [assignEventId, setAssignEventId] = useState(null)
  const [assignSearch, setAssignSearch] = useState('')
  const [assignSignups, setAssignSignups] = useState([])
  const [checkInEventId, setCheckInEventId] = useState(null)
  const [eventSignups, setEventSignups] = useState([])
  const [checkInLoading, setCheckInLoading] = useState(null)
  const [manualHoursMap, setManualHoursMap] = useState({})
  const [showAddVolunteer, setShowAddVolunteer] = useState(false)
  const [volunteerSearch, setVolunteerSearch] = useState('')
  const [bulkLoading, setBulkLoading] = useState(false)
  const [claimTokenModal, setClaimTokenModal] = useState(null)
  const [showCSVImport, setShowCSVImport] = useState(false)
  const [showBulkInvite, setShowBulkInvite] = useState(false)

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
      setShowEventForm(false); setEventForm({ title: '', description: '', date: '', location: '', ministryId: '', maxVolunteers: '', durationHours: '' })
      await loadData(); toast.success('Event created')
    } catch (err) { toast.error('Failed to create event') }
  }

  async function handleDeleteEvent(id) {
    if (!await confirm({ title: 'Delete Event', message: 'This will remove the event and all signups.', confirmLabel: 'Delete', danger: true })) return
    await deleteEvent(id); await loadData()
  }

  async function handleCreateMinistry(e) {
    e.preventDefault()
    try {
      await createMinistry(ministryForm); setShowMinistryForm(false); setMinistryForm({ name: '', description: '', leaderName: '', contactEmail: '' })
      await loadData(); toast.success('Ministry created')
    } catch (err) { toast.error('Failed to create ministry') }
  }

  async function handleDeleteMinistry(id) {
    if (!await confirm({ title: 'Delete Ministry', message: 'This will remove the ministry permanently.', confirmLabel: 'Delete', danger: true })) return
    await deleteMinistry(id); await loadData()
  }

  async function handleRoleChange(userId, newRole) { await updateUserRole(userId, newRole); await loadData() }

  async function openCheckIn(eventId) {
    setCheckInEventId(eventId); setManualHoursMap({}); setShowAddVolunteer(false); setVolunteerSearch('')
    const signups = await getEventSignups(eventId); setEventSignups(signups)
  }

  async function refreshSignups() { const signups = await getEventSignups(checkInEventId); setEventSignups(signups) }
  async function handleCheckIn(signupId) { setCheckInLoading(signupId); await checkIn(signupId); await refreshSignups(); setCheckInLoading(null) }

  async function handleCheckOut(signupId, userId) {
    setCheckInLoading(signupId)
    const manual = manualHoursMap[signupId]
    const hours = manual !== undefined && manual !== '' ? Number(manual) : null
    await checkOut(signupId, userId, hours)
    setManualHoursMap((prev) => { const n = { ...prev }; delete n[signupId]; return n })
    await refreshSignups(); setCheckInLoading(null); await loadData()
  }

  async function handleRelease(signupId) { setCheckInLoading(signupId); await releaseVolunteer(signupId); await refreshSignups(); setCheckInLoading(null) }
  async function handleNoShow(signupId) { setCheckInLoading(signupId); await markNoShow(signupId); await refreshSignups(); setCheckInLoading(null) }

  async function handleBulkCheckIn() {
    setBulkLoading(true)
    for (const s of eventSignups.filter((s) => s.status === 'signed_up')) { await checkIn(s.id) }
    await refreshSignups(); setBulkLoading(false)
  }

  async function handleBulkCheckOut() {
    if (!await confirm({ title: 'Check Out All', message: 'Check out all currently checked-in volunteers?', confirmLabel: 'Check Out All' })) return
    setBulkLoading(true)
    for (const s of eventSignups.filter((s) => s.status === 'checked_in')) {
      const manual = manualHoursMap[s.id]; const hours = manual !== undefined && manual !== '' ? Number(manual) : null
      await checkOut(s.id, s.userId, hours)
    }
    setManualHoursMap({}); await refreshSignups(); setBulkLoading(false); await loadData()
  }

  async function handleAddWalkIn(userId, displayName) {
    try { await adminAddVolunteer(checkInEventId, userId, displayName); setVolunteerSearch(''); setShowAddVolunteer(false); await refreshSignups(); await loadData() }
    catch (err) { toast.error(err.message) }
  }

  function setManualHours(signupId, value) { setManualHoursMap((prev) => ({ ...prev, [signupId]: value })) }
  function getMinistryName(id) { return ministries.find((m) => m.id === id)?.name || 'General' }
  function getDeptInfo(id) { return DEPARTMENTS.find((d) => d.id === id) }

  async function openAssignEvent(eventId) {
    if (assignEventId === eventId) { setAssignEventId(null); return }
    setAssignEventId(eventId); setAssignSearch('')
    const signups = await getEventSignups(eventId); setAssignSignups(signups)
  }

  async function handleAssignVolunteer(eventId, userId, displayName) {
    try { await signUpForEvent(eventId, userId, displayName); const signups = await getEventSignups(eventId); setAssignSignups(signups); await loadData() }
    catch (err) { toast.error(err.message) }
  }

  async function handleRemoveFromEvent(signupId, eventId) {
    await cancelSignup(signupId, eventId); const signups = await getEventSignups(eventId); setAssignSignups(signups); await loadData()
  }

  async function handleGenerateClaimLink(userId) {
    try { const token = await generateClaimForVolunteer(userId); setClaimTokenModal({ userId, token }); await loadData(); toast.success('Claim link generated') }
    catch (err) { toast.error('Failed to generate claim link') }
  }

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
          <div className="space-y-3">
            {events.map((event) => (
              <div key={event.id} className="card p-0 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3">
                  <div><p className="font-medium">{event.title}</p><p className="text-xs text-gray-500">{event.date?.toDate().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}{event.ministryId && ` · ${getMinistryName(event.ministryId)}`}</p></div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">{event.signupCount || 0} volunteers</span>
                    <button onClick={() => openAssignEvent(event.id)} className={`btn-secondary text-xs py-1 px-3 flex items-center space-x-1 ${assignEventId === event.id ? 'ring-2 ring-primary-400' : ''}`}><UserPlus size={12} /><span>Assign</span></button>
                    <button onClick={() => navigate(`/kiosk/${event.id}`)} className="btn-primary text-xs py-1 px-3">Kiosk</button>
                    <button onClick={() => handleDeleteEvent(event.id)} className="text-gray-400 hover:text-red-500 p-1"><Trash2 size={14} /></button>
                  </div>
                </div>
                {assignEventId === event.id && (
                  <div className="border-t border-gray-100 px-4 py-3 bg-gray-50">
                    <div className="relative mb-3"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input type="text" className="input pl-9 text-sm" placeholder="Search volunteers to add..." value={assignSearch} onChange={(e) => setAssignSearch(e.target.value)} /></div>
                    {assignSearch.length >= 2 && (<div className="mb-3 max-h-40 overflow-y-auto space-y-1">{users.filter((u) => (u.displayName || '').toLowerCase().includes(assignSearch.toLowerCase()) && !assignSignups.some((s) => s.userId === u.id)).slice(0, 8).map((u) => (<button key={u.id} onClick={() => { handleAssignVolunteer(event.id, u.id, u.displayName); setAssignSearch('') }} className="w-full flex items-center justify-between p-2 bg-white rounded hover:bg-blue-50 text-sm"><span>{u.displayName || u.email}{u.managed && <span className="ml-1 text-xs text-gray-400">(no account)</span>}</span><span className="text-primary-600 text-xs font-medium">+ Add</span></button>))}</div>)}
                    {assignSignups.length > 0 && (<div><p className="text-xs font-medium text-gray-500 mb-2">Assigned ({assignSignups.length})</p><div className="space-y-1">{assignSignups.map((s) => (<div key={s.id} className="flex items-center justify-between p-2 bg-white rounded text-sm"><div className="flex items-center gap-2"><span>{s.userName}</span>{s.department && <span className="badge bg-primary-100 text-primary-700 text-xs">{getDeptInfo(s.department)?.icon} {getDeptInfo(s.department)?.name}</span>}<span className={`badge text-xs ${s.status === 'checked_in' ? 'bg-green-100 text-green-700' : s.status === 'checked_out' ? 'bg-gray-100 text-gray-600' : 'bg-blue-100 text-blue-700'}`}>{s.status.replace('_', ' ')}</span></div>{s.status === 'signed_up' && (<button onClick={() => handleRemoveFromEvent(s.id, event.id)} className="text-gray-400 hover:text-red-500 p-1"><XCircle size={14} /></button>)}</div>))}</div></div>)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'ministries' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center"><h2 className="font-semibold text-lg">Manage Ministries</h2><button onClick={() => setShowMinistryForm(!showMinistryForm)} className="btn-primary flex items-center space-x-1"><Plus size={16} /><span>New Ministry</span></button></div>
          {showMinistryForm && (<form onSubmit={handleCreateMinistry} className="card space-y-4"><h3 className="font-semibold">Create Ministry</h3><div className="grid sm:grid-cols-2 gap-4"><div><label className="label">Name *</label><input className="input" required value={ministryForm.name} onChange={(e) => setMinistryForm({ ...ministryForm, name: e.target.value })} /></div><div><label className="label">Leader Name</label><input className="input" value={ministryForm.leaderName} onChange={(e) => setMinistryForm({ ...ministryForm, leaderName: e.target.value })} /></div><div className="sm:col-span-2"><label className="label">Description</label><textarea className="input" rows={2} value={ministryForm.description} onChange={(e) => setMinistryForm({ ...ministryForm, description: e.target.value })} /></div><div><label className="label">Contact Email</label><input type="email" className="input" value={ministryForm.contactEmail} onChange={(e) => setMinistryForm({ ...ministryForm, contactEmail: e.target.value })} /></div></div><div className="flex space-x-2"><button type="submit" className="btn-primary">Create Ministry</button><button type="button" onClick={() => setShowMinistryForm(false)} className="btn-secondary">Cancel</button></div></form>)}
          <div className="grid gap-4 md:grid-cols-2">{ministries.map((m) => (<div key={m.id} className="card flex justify-between items-start"><div><h3 className="font-semibold">{m.name}</h3>{m.description && <p className="text-sm text-gray-500 mt-1">{m.description}</p>}<p className="text-xs text-gray-400 mt-1">{m.leaderName && `Led by ${m.leaderName}`}{m.memberCount ? ` · ${m.memberCount} members` : ''}</p></div><button onClick={() => handleDeleteMinistry(m.id)} className="text-red-500 hover:text-red-700 p-1"><Trash2 size={14} /></button></div>))}</div>
        </div>
      )}

      {tab === 'users' && (
        <div className="space-y-4">
          <div className="flex flex-wrap justify-between items-center gap-2">
            <h2 className="font-semibold text-lg">Manage Users ({users.length})</h2>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setShowCSVImport(!showCSVImport)} className="btn-secondary flex items-center space-x-1 text-sm"><Upload size={14} /><span>Import CSV</span></button>
              <button onClick={() => setShowBulkInvite(true)} className="btn-secondary flex items-center space-x-1 text-sm"><Mail size={14} /><span>Bulk Invite</span></button>
              <button onClick={() => setShowVolunteerForm(!showVolunteerForm)} className="btn-primary flex items-center space-x-1 text-sm"><UserPlus size={14} /><span>Add Volunteer</span></button>
            </div>
          </div>

          {showCSVImport && <CSVImport onComplete={() => { setShowCSVImport(false); loadData() }} />}
          {showBulkInvite && <BulkInviteModal volunteers={users} onClose={() => { setShowBulkInvite(false); loadData() }} />}

          {showVolunteerForm && (
            <form onSubmit={async (e) => { e.preventDefault(); if (!volunteerForm.displayName.trim()) return toast.error('Name is required'); try { await createManagedVolunteer(volunteerForm); setVolunteerForm({ displayName: '', email: '', phone: '' }); setShowVolunteerForm(false); await loadData(); toast.success('Volunteer added') } catch (err) { toast.error('Failed to create volunteer') } }} className="card space-y-4">
              <h3 className="font-semibold">Add Volunteer (no account needed)</h3>
              <div className="grid sm:grid-cols-3 gap-4">
                <div><label className="label">Name *</label><input className="input" required value={volunteerForm.displayName} onChange={(e) => setVolunteerForm({ ...volunteerForm, displayName: e.target.value })} placeholder="John Doe" /></div>
                <div><label className="label">Email</label><input type="email" className="input" value={volunteerForm.email} onChange={(e) => setVolunteerForm({ ...volunteerForm, email: e.target.value })} placeholder="john@email.com" /></div>
                <div><label className="label">Phone</label><input type="tel" className="input" value={volunteerForm.phone} onChange={(e) => setVolunteerForm({ ...volunteerForm, phone: e.target.value })} placeholder="(555) 123-4567" /></div>
              </div>
              <div className="flex space-x-2"><button type="submit" className="btn-primary">Add Volunteer</button><button type="button" onClick={() => setShowVolunteerForm(false)} className="btn-secondary">Cancel</button></div>
            </form>
          )}

          <div className="card p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b"><tr><th className="text-left px-4 py-3">Name</th><th className="text-left px-4 py-3 hidden sm:table-cell">Email</th><th className="text-right px-4 py-3">Hours</th><th className="text-left px-4 py-3">Role</th><th className="text-left px-4 py-3 hidden md:table-cell">Department</th><th className="text-right px-4 py-3 w-24"></th></tr></thead>
              <tbody className="divide-y">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3"><span className="font-medium">{u.displayName || 'Unknown'}</span>{u.managed && <span className="ml-2 badge bg-gray-100 text-gray-500">No account</span>}</td>
                    <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">{u.email || '-'}</td>
                    <td className="px-4 py-3 text-right">{formatHours(u.totalHours || 0)}</td>
                    <td className="px-4 py-3"><select className="input py-1 text-xs w-auto" value={u.role} onChange={(e) => handleRoleChange(u.id, e.target.value)}><option value="volunteer">Volunteer</option><option value="ministry_leader">Leader</option><option value="admin">Admin</option></select></td>
                    <td className="px-4 py-3 hidden md:table-cell">{u.role === 'ministry_leader' ? (<select className="input py-1 text-xs w-auto" value={u.assignedDepartment || ''} onChange={async (e) => { await updateVolunteerProfile(u.id, { assignedDepartment: e.target.value || null }); await loadData() }}><option value="">None</option>{DEPARTMENTS.map((d) => (<option key={d.id} value={d.id}>{d.name}</option>))}</select>) : '-'}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {u.managed && !u.claimToken && (<button onClick={() => handleGenerateClaimLink(u.id)} className="text-gray-400 hover:text-primary-600 p-1" title="Generate claim link"><LinkIcon size={14} /></button>)}
                        {u.managed && u.claimToken && (<button onClick={() => setClaimTokenModal({ userId: u.id, token: u.claimToken })} className="text-primary-600 hover:text-primary-700 p-1" title="Show QR code"><QrCode size={14} /></button>)}
                        {u.managed && (<button onClick={async () => { if (!await confirm({ title: 'Delete Volunteer', message: `Remove ${u.displayName}?`, confirmLabel: 'Delete', danger: true })) return; await deleteVolunteer(u.id); await loadData(); toast.success(`${u.displayName} removed`) }} className="text-gray-400 hover:text-red-500 p-1"><Trash2 size={14} /></button>)}
                      </div>
                    </td>
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
          <p className="text-sm text-gray-500">Select an event to manage attendance, or open Kiosk Mode</p>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {events.filter((e) => { const d = e.date?.toDate(); return d && d >= new Date(Date.now() - 7 * 86400000) }).sort((a, b) => b.date.toDate() - a.date.toDate()).map((event) => {
              const isPast = event.date?.toDate() < new Date()
              return (
                <div key={event.id} className={`card hover:shadow-md transition-shadow ${checkInEventId === event.id ? 'ring-2 ring-primary-500' : ''} ${isPast ? 'opacity-75' : ''}`}>
                  <button onClick={() => openCheckIn(event.id)} className="w-full text-left">
                    <h3 className="font-semibold">{event.title}</h3>
                    <p className="text-sm text-gray-500">{event.date?.toDate().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
                    <p className="text-xs text-gray-400 mt-1">{event.signupCount || 0} signups</p>
                  </button>
                  <button onClick={() => navigate(`/kiosk/${event.id}`)} className="mt-2 w-full btn-kiosk !text-sm !py-2 !min-h-[40px]">Open Kiosk Mode</button>
                </div>
              )
            })}
          </div>

          {checkInEventId && (
            <div className="card">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div>
                  <h3 className="font-semibold text-lg">Attendance</h3>
                  <p className="text-xs text-gray-400">{eventSignups.filter((s) => s.status === 'checked_in').length} in {' · '}{eventSignups.filter((s) => s.status === 'checked_out').length} out {' · '}{eventSignups.filter((s) => s.status === 'signed_up').length} pending</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => setShowAddVolunteer(!showAddVolunteer)} className="btn-secondary text-xs py-1.5 px-3 flex items-center space-x-1"><UserPlus size={12} /><span>Add Walk-In</span></button>
                  {eventSignups.some((s) => s.status === 'signed_up') && (<button onClick={handleBulkCheckIn} disabled={bulkLoading} className="btn-primary text-xs py-1.5 px-3 flex items-center space-x-1"><UserCheck size={12} /><span>{bulkLoading ? '...' : 'Check All In'}</span></button>)}
                  {eventSignups.some((s) => s.status === 'checked_in') && (<button onClick={handleBulkCheckOut} disabled={bulkLoading} className="btn-secondary text-xs py-1.5 px-3 flex items-center space-x-1"><UserX size={12} /><span>{bulkLoading ? '...' : 'Check All Out'}</span></button>)}
                </div>
              </div>
              {showAddVolunteer && (<div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg"><div className="relative"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input type="text" className="input pl-9 text-sm" placeholder="Search by name..." value={volunteerSearch} onChange={(e) => setVolunteerSearch(e.target.value)} /></div>{volunteerSearch.length >= 2 && (<div className="mt-2 max-h-40 overflow-y-auto space-y-1">{users.filter((u) => (u.displayName || '').toLowerCase().includes(volunteerSearch.toLowerCase()) && !eventSignups.some((s) => s.userId === u.id)).slice(0, 8).map((u) => (<button key={u.id} onClick={() => handleAddWalkIn(u.id, u.displayName)} className="w-full flex items-center justify-between p-2 bg-white rounded hover:bg-gray-50 text-sm"><span>{u.displayName || u.email}</span><span className="text-primary-600 text-xs font-medium">+ Add & Check In</span></button>))}</div>)}</div>)}
              {eventSignups.length === 0 ? (<p className="text-gray-400 text-sm text-center py-4">No signups</p>) : (
                <div className="space-y-2">{eventSignups.sort((a, b) => { const o = { checked_in: 0, signed_up: 1, checked_out: 2, released: 3, no_show: 4 }; return (o[a.status] || 5) - (o[b.status] || 5) }).map((signup) => (
                  <div key={signup.id} className={`p-3 rounded-lg ${signup.status === 'checked_in' ? 'bg-green-50 border border-green-200' : signup.status === 'no_show' ? 'bg-red-50 border border-red-100' : signup.status === 'released' ? 'bg-yellow-50 border border-yellow-100' : 'bg-gray-50'}`}>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="min-w-0"><p className="font-medium text-sm">{signup.userName}</p><p className="text-xs text-gray-400 capitalize">{signup.status.replace('_', ' ')}{signup.status === 'checked_in' && signup.checkedInAt && ` since ${signup.checkedInAt.toDate().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`}</p></div>
                        {(signup.status === 'signed_up' || signup.status === 'checked_in') && (<select className="input py-1 text-xs w-auto" value={signup.department || ''} onChange={async (e) => { await assignDepartment(signup.id, e.target.value); await refreshSignups() }}><option value="">Dept...</option>{DEPARTMENTS.map((d) => (<option key={d.id} value={d.id}>{d.icon} {d.name}</option>))}</select>)}
                        {(signup.status === 'checked_out' || signup.status === 'released') && signup.department && (<span className="badge bg-primary-100 text-primary-700 text-xs">{getDeptInfo(signup.department)?.icon} {getDeptInfo(signup.department)?.name}</span>)}
                      </div>
                      <div className="flex items-center gap-2">
                        {signup.status === 'signed_up' && (<><button onClick={() => handleCheckIn(signup.id)} disabled={checkInLoading === signup.id} className="btn-primary text-xs py-1 px-3"><UserCheck size={12} className="inline mr-1" />{checkInLoading === signup.id ? '...' : 'In'}</button><button onClick={() => handleNoShow(signup.id)} className="text-gray-400 hover:text-red-500 p-1"><XCircle size={16} /></button></>)}
                        {signup.status === 'checked_in' && (<><input type="number" step="0.25" min="0" className="input py-1 text-xs w-16 text-center" placeholder="hrs" value={manualHoursMap[signup.id] || ''} onChange={(e) => setManualHours(signup.id, e.target.value)} /><button onClick={() => handleCheckOut(signup.id, signup.userId)} disabled={checkInLoading === signup.id} className="btn-primary text-xs py-1 px-3"><UserX size={12} className="inline mr-1" />{checkInLoading === signup.id ? '...' : 'Out'}</button><button onClick={() => handleRelease(signup.id)} className="text-gray-400 hover:text-amber-500 p-1"><MinusCircle size={16} /></button></>)}
                        {signup.status === 'checked_out' && (<span className="text-xs text-green-600 font-medium">{formatHours(signup.hoursLogged)}</span>)}
                        {signup.status === 'released' && (<span className="text-xs text-amber-600">Released</span>)}
                        {signup.status === 'no_show' && (<span className="text-xs text-red-500">No-show</span>)}
                      </div>
                    </div>
                  </div>
                ))}</div>
              )}
            </div>
          )}
        </div>
      )}

      {claimTokenModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setClaimTokenModal(null)}>
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-lg mb-4">Claim Link</h3>
            <ClaimQRCode token={claimTokenModal.token} />
            <button onClick={() => setClaimTokenModal(null)} className="btn-secondary w-full mt-4">Close</button>
          </div>
        </div>
      )}

      {ConfirmDialog}
    </div>
  )
}
