import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../components/ToastProvider'
import { useConfirm } from '../hooks/useConfirm'
import {
  getAllUsers,
  getEvents,
  getMinistries,
  getServiceHoursSummary,
  getAttendanceLogs,
  createEvent,
  updateEvent,
  createMinistry,
  updateMinistry,
  deleteEvent,
  deleteMinistry,
  updateUserRole,
  getEventSignups,
  signUpForEvent,
  cancelSignup,
  checkIn,
  checkOut,
  adminAddVolunteer,
  releaseVolunteer,
  markNoShow,
  createManagedVolunteer,
  deleteVolunteer,
  assignDepartment,
  updateVolunteerProfile,
  generateClaimForVolunteer,
  createEventTemplate,
  getEventTemplates,
  deleteEventTemplate,
  generateEventsFromTemplate,
} from '../services/firestore'
import { formatHours } from '../utils/gamification'
import { DEPARTMENTS } from '../utils/departments'
import { exportToJSON } from '../utils/csvExport'
import StatCard from '../components/StatCard'
import BarChart from '../components/BarChart'
import ClaimQRCode from '../components/ClaimQRCode'
import {
  Users, Calendar, Clock, Award, Plus, Trash2,
  UserCheck, UserX, BarChart3,
  Search, MinusCircle, XCircle, UserPlus, Link as LinkIcon, QrCode,
  Upload, Mail, Pencil, Repeat, Download, ScrollText, Settings,
} from 'lucide-react'
import { Timestamp } from 'firebase/firestore'
import CSVImport from '../components/CSVImport'
import BulkInviteModal from '../components/BulkInviteModal'
import AuditLogViewer from '../components/AuditLogViewer'
import BrandingSettings from '../components/BrandingSettings'

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

  // Forms
  const [showEventForm, setShowEventForm] = useState(false)
  const [showMinistryForm, setShowMinistryForm] = useState(false)
  const [eventForm, setEventForm] = useState({
    title: '', description: '', date: '', location: '',
    ministryId: '', maxVolunteers: '', durationHours: '',
  })
  const [ministryForm, setMinistryForm] = useState({
    name: '', description: '', leaderName: '', contactEmail: '',
  })

  // Add Volunteer (managed, no account)
  const [showVolunteerForm, setShowVolunteerForm] = useState(false)
  const [volunteerForm, setVolunteerForm] = useState({ displayName: '', email: '', phone: '' })

  // Assign volunteers to event (from Events tab)
  const [assignEventId, setAssignEventId] = useState(null)
  const [assignSearch, setAssignSearch] = useState('')
  const [assignSignups, setAssignSignups] = useState([])

  // Check-in
  const [checkInEventId, setCheckInEventId] = useState(null)
  const [eventSignups, setEventSignups] = useState([])
  const [checkInLoading, setCheckInLoading] = useState(null)
  const [manualHoursMap, setManualHoursMap] = useState({}) // signupId -> hours string
  const [showAddVolunteer, setShowAddVolunteer] = useState(false)
  const [volunteerSearch, setVolunteerSearch] = useState('')
  const [bulkLoading, setBulkLoading] = useState(false)
  const [claimTokenModal, setClaimTokenModal] = useState(null) // { userId, token } or null
  const [showCSVImport, setShowCSVImport] = useState(false)
  const [showBulkInvite, setShowBulkInvite] = useState(false)

  // Edit state
  const [editingEvent, setEditingEvent] = useState(null)
  const [editingMinistry, setEditingMinistry] = useState(null)

  // Recurring events
  const [isRecurring, setIsRecurring] = useState(false)
  const [recurringForm, setRecurringForm] = useState({
    recurrenceType: 'weekly', dayOfWeek: 0, time: '09:00',
  })
  const [templates, setTemplates] = useState([])
  const [generateRange, setGenerateRange] = useState({ templateId: '', months: 3 })

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const [usersData, eventsData, ministriesData, hoursData, templatesData] = await Promise.all([
        getAllUsers(),
        getEvents(),
        getMinistries(),
        getServiceHoursSummary(),
        getEventTemplates(),
      ])
      setUsers(usersData)
      setEvents(eventsData)
      setMinistries(ministriesData)
      setServiceHours(hoursData)
      setTemplates(templatesData)
    } catch (err) {
      console.error('Error loading admin data:', err)
    }
    setLoading(false)
  }

  // Stats
  const totalVolunteers = users.filter((u) => u.role === 'volunteer').length
  const totalHours = users.reduce((sum, u) => sum + (u.totalHours || 0), 0)
  const upcomingEvents = events.filter((e) => e.date?.toDate() > new Date()).length

  // Analytics: hours by department this month
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const hoursByDeptThisMonth = (() => {
    const byDept = {}
    const eventMap = Object.fromEntries(events.map((e) => [e.id, e]))
    for (const h of serviceHours) {
      const d = h.date && typeof h.date.toDate === 'function' ? h.date.toDate() : null
      if (d && d >= monthStart) {
        const event = eventMap[h.eventId]
        const dept = event?.ministryId ? (ministries.find((m) => m.id === event.ministryId)?.name || event.ministryId) : 'General'
        byDept[dept] = (byDept[dept] || 0) + (h.hours || 0)
      }
    }
    return Object.entries(byDept).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value)
  })()

  // Analytics: monthly trend (last 6 months)
  const monthlyTrend = (() => {
    const months = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      months.push({ start: d, end: new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59), label: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }) })
    }
    return months.map((m) => {
      const total = serviceHours.reduce((sum, h) => {
        const d = h.date && typeof h.date.toDate === 'function' ? h.date.toDate() : null
        return d && d >= m.start && d <= m.end ? sum + (h.hours || 0) : sum
      }, 0)
      return { label: m.label, value: total }
    })
  })()

  // Export all data
  const [exportLoading, setExportLoading] = useState(false)
  async function handleExportAll() {
    setExportLoading(true)
    try {
      const [allLogs, allSignups] = await Promise.all([
        getAttendanceLogs(),
        Promise.resolve([]), // eventSignups are per-event, we include the loaded data
      ])
      const exportData = {
        exportedAt: new Date().toISOString(),
        users: users.map((u) => ({ ...u, createdAt: u.createdAt?.toDate?.()?.toISOString() || null, updatedAt: u.updatedAt?.toDate?.()?.toISOString() || null, lastServedDate: u.lastServedDate?.toDate?.()?.toISOString() || null })),
        events: events.map((e) => ({ ...e, date: e.date?.toDate?.()?.toISOString() || null, createdAt: e.createdAt?.toDate?.()?.toISOString() || null })),
        ministries: ministries.map((m) => ({ ...m, createdAt: m.createdAt?.toDate?.()?.toISOString() || null })),
        serviceHours: serviceHours.map((h) => ({ ...h, date: h.date?.toDate?.()?.toISOString() || null })),
        attendanceLogs: allLogs.map((l) => ({ ...l, createdAt: l.createdAt?.toDate?.()?.toISOString() || null, checkedInAt: l.checkedInAt?.toDate?.()?.toISOString() || null, checkedOutAt: l.checkedOutAt?.toDate?.()?.toISOString() || null })),
      }
      exportToJSON(exportData, `church_volunteer_export_${new Date().toISOString().slice(0, 10)}.json`)
      toast.success('Data exported')
    } catch (err) {
      console.error('Export error:', err)
      toast.error('Failed to export data')
    }
    setExportLoading(false)
  }

  // Event CRUD
  async function handleSubmitEvent(e) {
    e.preventDefault()
    try {
      if (isRecurring && !editingEvent) {
        // Create a recurring event template
        await createEventTemplate({
          title: eventForm.title,
          description: eventForm.description,
          location: eventForm.location,
          ministryId: eventForm.ministryId,
          maxVolunteers: eventForm.maxVolunteers ? Number(eventForm.maxVolunteers) : null,
          durationHours: eventForm.durationHours ? Number(eventForm.durationHours) : null,
          recurrenceType: recurringForm.recurrenceType,
          dayOfWeek: Number(recurringForm.dayOfWeek),
          time: recurringForm.time,
        })
        toast.success('Recurring template created')
      } else if (editingEvent) {
        // Update existing event
        await updateEvent(editingEvent.id, {
          title: eventForm.title,
          description: eventForm.description,
          date: Timestamp.fromDate(new Date(eventForm.date)),
          location: eventForm.location,
          ministryId: eventForm.ministryId,
          maxVolunteers: eventForm.maxVolunteers ? Number(eventForm.maxVolunteers) : null,
          durationHours: eventForm.durationHours ? Number(eventForm.durationHours) : null,
        })
        toast.success('Event updated')
      } else {
        await createEvent({
          ...eventForm,
          date: Timestamp.fromDate(new Date(eventForm.date)),
          maxVolunteers: eventForm.maxVolunteers ? Number(eventForm.maxVolunteers) : null,
          durationHours: eventForm.durationHours ? Number(eventForm.durationHours) : null,
        })
        toast.success('Event created')
      }
      setShowEventForm(false)
      setEditingEvent(null)
      setIsRecurring(false)
      setEventForm({ title: '', description: '', date: '', location: '', ministryId: '', maxVolunteers: '', durationHours: '' })
      setRecurringForm({ recurrenceType: 'weekly', dayOfWeek: 0, time: '09:00' })
      await loadData()
    } catch (err) {
      toast.error(editingEvent ? 'Failed to update event' : 'Failed to create event')
    }
  }

  function startEditEvent(event) {
    const dateObj = event.date?.toDate()
    const dateStr = dateObj ? new Date(dateObj.getTime() - dateObj.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''
    setEditingEvent(event)
    setEventForm({
      title: event.title || '',
      description: event.description || '',
      date: dateStr,
      location: event.location || '',
      ministryId: event.ministryId || '',
      maxVolunteers: event.maxVolunteers || '',
      durationHours: event.durationHours || '',
    })
    setIsRecurring(false)
    setShowEventForm(true)
  }

  function cancelEventForm() {
    setShowEventForm(false)
    setEditingEvent(null)
    setIsRecurring(false)
    setEventForm({ title: '', description: '', date: '', location: '', ministryId: '', maxVolunteers: '', durationHours: '' })
    setRecurringForm({ recurrenceType: 'weekly', dayOfWeek: 0, time: '09:00' })
  }

  async function handleGenerateEvents(templateId) {
    const template = templates.find((t) => t.id === templateId)
    if (!template) return
    try {
      const start = new Date()
      const end = new Date()
      end.setMonth(end.getMonth() + (generateRange.months || 3))
      const created = await generateEventsFromTemplate(template, start, end)
      await loadData()
      toast.success(`Generated ${created.length} events`)
    } catch (err) {
      toast.error('Failed to generate events')
    }
  }

  async function handleDeleteTemplate(id) {
    if (!await confirm({ title: 'Delete Template', message: 'This will remove the recurring template. Existing generated events will remain.', confirmLabel: 'Delete', danger: true })) return
    await deleteEventTemplate(id)
    await loadData()
    toast.success('Template deleted')
  }

  async function handleDeleteEvent(id) {
    if (!await confirm({ title: 'Delete Event', message: 'This will remove the event and all signups.', confirmLabel: 'Delete', danger: true })) return
    await deleteEvent(id)
    await loadData()
  }

  // Ministry CRUD
  async function handleSubmitMinistry(e) {
    e.preventDefault()
    try {
      if (editingMinistry) {
        await updateMinistry(editingMinistry.id, {
          name: ministryForm.name,
          description: ministryForm.description,
          leaderName: ministryForm.leaderName,
          contactEmail: ministryForm.contactEmail,
        })
        toast.success('Ministry updated')
      } else {
        await createMinistry(ministryForm)
        toast.success('Ministry created')
      }
      setShowMinistryForm(false)
      setEditingMinistry(null)
      setMinistryForm({ name: '', description: '', leaderName: '', contactEmail: '' })
      await loadData()
    } catch (err) {
      toast.error(editingMinistry ? 'Failed to update ministry' : 'Failed to create ministry')
    }
  }

  function startEditMinistry(ministry) {
    setEditingMinistry(ministry)
    setMinistryForm({
      name: ministry.name || '',
      description: ministry.description || '',
      leaderName: ministry.leaderName || '',
      contactEmail: ministry.contactEmail || '',
    })
    setShowMinistryForm(true)
  }

  function cancelMinistryForm() {
    setShowMinistryForm(false)
    setEditingMinistry(null)
    setMinistryForm({ name: '', description: '', leaderName: '', contactEmail: '' })
  }

  async function handleDeleteMinistry(id) {
    if (!await confirm({ title: 'Delete Ministry', message: 'This will remove the ministry permanently.', confirmLabel: 'Delete', danger: true })) return
    await deleteMinistry(id)
    await loadData()
  }

  // User role
  async function handleRoleChange(userId, newRole) {
    await updateUserRole(userId, newRole)
    await loadData()
  }

  // Check-in management
  async function openCheckIn(eventId) {
    setCheckInEventId(eventId)
    setManualHoursMap({})
    setShowAddVolunteer(false)
    setVolunteerSearch('')
    const signups = await getEventSignups(eventId)
    setEventSignups(signups)
  }

  async function refreshSignups() {
    const signups = await getEventSignups(checkInEventId)
    setEventSignups(signups)
  }

  async function handleCheckIn(signupId) {
    setCheckInLoading(signupId)
    await checkIn(signupId)
    await refreshSignups()
    setCheckInLoading(null)
  }

  async function handleCheckOut(signupId, userId) {
    setCheckInLoading(signupId)
    const manual = manualHoursMap[signupId]
    const hours = manual !== undefined && manual !== '' ? Number(manual) : null
    await checkOut(signupId, userId, hours)
    setManualHoursMap((prev) => { const n = { ...prev }; delete n[signupId]; return n })
    await refreshSignups()
    setCheckInLoading(null)
    await loadData()
  }

  async function handleRelease(signupId) {
    setCheckInLoading(signupId)
    await releaseVolunteer(signupId)
    await refreshSignups()
    setCheckInLoading(null)
  }

  async function handleNoShow(signupId) {
    setCheckInLoading(signupId)
    await markNoShow(signupId)
    await refreshSignups()
    setCheckInLoading(null)
  }

  async function handleBulkCheckIn() {
    setBulkLoading(true)
    const pending = eventSignups.filter((s) => s.status === 'signed_up')
    for (const s of pending) {
      await checkIn(s.id)
    }
    await refreshSignups()
    setBulkLoading(false)
  }

  async function handleBulkCheckOut() {
    if (!await confirm({ title: 'Check Out All', message: 'Check out all currently checked-in volunteers? Hours will be calculated from check-in time.', confirmLabel: 'Check Out All' })) return
    setBulkLoading(true)
    const active = eventSignups.filter((s) => s.status === 'checked_in')
    for (const s of active) {
      const manual = manualHoursMap[s.id]
      const hours = manual !== undefined && manual !== '' ? Number(manual) : null
      await checkOut(s.id, s.userId, hours)
    }
    setManualHoursMap({})
    await refreshSignups()
    setBulkLoading(false)
    await loadData()
  }

  async function handleAddWalkIn(userId, displayName) {
    try {
      await adminAddVolunteer(checkInEventId, userId, displayName)
      setVolunteerSearch('')
      setShowAddVolunteer(false)
      await refreshSignups()
      await loadData()
    } catch (err) {
      toast.error(err.message)
    }
  }

  function setManualHours(signupId, value) {
    setManualHoursMap((prev) => ({ ...prev, [signupId]: value }))
  }

  function getMinistryName(id) {
    return ministries.find((m) => m.id === id)?.name || 'General'
  }

  async function openAssignEvent(eventId) {
    if (assignEventId === eventId) { setAssignEventId(null); return }
    setAssignEventId(eventId)
    setAssignSearch('')
    const signups = await getEventSignups(eventId)
    setAssignSignups(signups)
  }

  async function handleAssignVolunteer(eventId, userId, displayName) {
    try {
      await signUpForEvent(eventId, userId, displayName)
      const signups = await getEventSignups(eventId)
      setAssignSignups(signups)
      await loadData()
    } catch (err) { toast.error(err.message) }
  }

  async function handleRemoveFromEvent(signupId, eventId) {
    await cancelSignup(signupId, eventId)
    const signups = await getEventSignups(eventId)
    setAssignSignups(signups)
    await loadData()
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'events', label: 'Events', icon: Calendar },
    { id: 'ministries', label: 'Ministries', icon: Users },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'checkin', label: 'Check-In', icon: UserCheck },
    { id: 'auditlog', label: 'Audit Log', icon: ScrollText },
    { id: 'settings', label: 'Settings', icon: Settings },
  ]

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Admin Dashboard</h1>

      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-1 border-b border-gray-200 pb-0">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center space-x-1 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t.id
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <t.icon size={16} />
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {tab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="Total Volunteers" value={totalVolunteers} icon={Users} color="primary" />
            <StatCard title="Total Hours" value={formatHours(totalHours)} icon={Clock} color="green" />
            <StatCard title="Upcoming Events" value={upcomingEvents} icon={Calendar} color="orange" />
            <StatCard title="Ministries" value={ministries.length} icon={Award} color="purple" />
          </div>

          {/* Analytics Charts */}
          <div className="grid md:grid-cols-2 gap-6">
            <BarChart title="Hours This Month by Department" data={hoursByDeptThisMonth} color="primary" unit="h" />
            <BarChart title="Monthly Trend (Last 6 Months)" data={monthlyTrend} color="green" unit="h" />
          </div>

          {/* Export All Data */}
          <div className="flex justify-end">
            <button
              onClick={handleExportAll}
              disabled={exportLoading}
              className="btn-secondary flex items-center gap-1 text-sm"
            >
              <Download size={16} />
              {exportLoading ? 'Exporting...' : 'Export All Data'}
            </button>
          </div>

          {/* Top Volunteers */}
          <div className="card">
            <h2 className="font-semibold text-lg mb-4">Top Volunteers</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-3 py-2">Name</th>
                    <th className="text-right px-3 py-2">Hours</th>
                    <th className="text-right px-3 py-2">Points</th>
                    <th className="text-right px-3 py-2">Badges</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {users
                    .sort((a, b) => (b.totalHours || 0) - (a.totalHours || 0))
                    .slice(0, 10)
                    .map((u) => (
                      <tr key={u.id}>
                        <td className="px-3 py-2">{u.displayName || u.email}</td>
                        <td className="px-3 py-2 text-right">{formatHours(u.totalHours || 0)}</td>
                        <td className="px-3 py-2 text-right">{u.totalPoints || 0}</td>
                        <td className="px-3 py-2 text-right">{(u.badges || []).length}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Events Tab */}
      {tab === 'events' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="font-semibold text-lg">Manage Events</h2>
            <button onClick={() => { cancelEventForm(); setShowEventForm(!showEventForm) }} className="btn-primary flex items-center space-x-1">
              <Plus size={16} />
              <span>New Event</span>
            </button>
          </div>

          {showEventForm && (
            <form onSubmit={handleSubmitEvent} className="card space-y-4">
              <h3 className="font-semibold">{editingEvent ? 'Edit Event' : 'Create Event'}</h3>

              {!editingEvent && (
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isRecurring}
                      onChange={(e) => setIsRecurring(e.target.checked)}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <Repeat size={14} />
                    <span>Recurring Event</span>
                  </label>
                </div>
              )}

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Title *</label>
                  <input className="input" required value={eventForm.title}
                    onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })} />
                </div>
                {!isRecurring && (
                  <div>
                    <label className="label">Date & Time *</label>
                    <input type="datetime-local" className="input" required value={eventForm.date}
                      onChange={(e) => setEventForm({ ...eventForm, date: e.target.value })} />
                  </div>
                )}
                {isRecurring && (
                  <>
                    <div>
                      <label className="label">Recurrence *</label>
                      <select className="input" value={recurringForm.recurrenceType}
                        onChange={(e) => setRecurringForm({ ...recurringForm, recurrenceType: e.target.value })}>
                        <option value="weekly">Weekly</option>
                        <option value="biweekly">Biweekly</option>
                        <option value="monthly">Monthly</option>
                      </select>
                    </div>
                    <div>
                      <label className="label">Day of Week *</label>
                      <select className="input" value={recurringForm.dayOfWeek}
                        onChange={(e) => setRecurringForm({ ...recurringForm, dayOfWeek: e.target.value })}>
                        <option value={0}>Sunday</option>
                        <option value={1}>Monday</option>
                        <option value={2}>Tuesday</option>
                        <option value={3}>Wednesday</option>
                        <option value={4}>Thursday</option>
                        <option value={5}>Friday</option>
                        <option value={6}>Saturday</option>
                      </select>
                    </div>
                    <div>
                      <label className="label">Time *</label>
                      <input type="time" className="input" required value={recurringForm.time}
                        onChange={(e) => setRecurringForm({ ...recurringForm, time: e.target.value })} />
                    </div>
                  </>
                )}
                <div>
                  <label className="label">Location</label>
                  <input className="input" value={eventForm.location}
                    onChange={(e) => setEventForm({ ...eventForm, location: e.target.value })} />
                </div>
                <div>
                  <label className="label">Ministry</label>
                  <select className="input" value={eventForm.ministryId}
                    onChange={(e) => setEventForm({ ...eventForm, ministryId: e.target.value })}>
                    <option value="">General</option>
                    {ministries.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Max Volunteers</label>
                  <input type="number" className="input" value={eventForm.maxVolunteers}
                    onChange={(e) => setEventForm({ ...eventForm, maxVolunteers: e.target.value })} />
                </div>
                <div>
                  <label className="label">Duration (hours)</label>
                  <input type="number" step="0.5" className="input" value={eventForm.durationHours}
                    onChange={(e) => setEventForm({ ...eventForm, durationHours: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="label">Description</label>
                <textarea className="input" rows={3} value={eventForm.description}
                  onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })} />
              </div>
              <div className="flex space-x-2">
                <button type="submit" className="btn-primary">
                  {editingEvent ? 'Update Event' : isRecurring ? 'Create Template' : 'Create Event'}
                </button>
                <button type="button" onClick={cancelEventForm} className="btn-secondary">Cancel</button>
              </div>
            </form>
          )}

          {/* Recurring Templates Section */}
          {templates.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold text-sm text-gray-600 flex items-center gap-1">
                <Repeat size={14} />
                Recurring Templates
              </h3>
              {templates.map((tmpl) => {
                const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
                return (
                  <div key={tmpl.id} className="card p-3 bg-purple-50 border border-purple-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{tmpl.title}</p>
                        <p className="text-xs text-gray-500">
                          {tmpl.recurrenceType} on {dayNames[tmpl.dayOfWeek]} at {tmpl.time}
                          {tmpl.ministryId && ` · ${getMinistryName(tmpl.ministryId)}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          className="input py-1 text-xs w-auto"
                          value={generateRange.templateId === tmpl.id ? generateRange.months : 3}
                          onChange={(e) => setGenerateRange({ templateId: tmpl.id, months: Number(e.target.value) })}
                        >
                          <option value={1}>1 month</option>
                          <option value={3}>3 months</option>
                          <option value={6}>6 months</option>
                          <option value={12}>12 months</option>
                        </select>
                        <button
                          onClick={() => handleGenerateEvents(tmpl.id)}
                          className="btn-primary text-xs py-1 px-3 flex items-center space-x-1"
                        >
                          <Calendar size={12} />
                          <span>Generate</span>
                        </button>
                        <button onClick={() => handleDeleteTemplate(tmpl.id)} className="text-gray-400 hover:text-red-500 p-1">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <div className="space-y-3">
            {events.map((event) => (
              <div key={event.id} className="card p-0 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="font-medium">{event.title}</p>
                    <p className="text-xs text-gray-500">
                      {event.date?.toDate().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                      {event.ministryId && ` · ${getMinistryName(event.ministryId)}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">{event.signupCount || 0} volunteers</span>
                    <button onClick={() => openAssignEvent(event.id)} className={`btn-secondary text-xs py-1 px-3 flex items-center space-x-1 ${assignEventId === event.id ? 'ring-2 ring-primary-400' : ''}`}>
                      <UserPlus size={12} />
                      <span>Assign</span>
                    </button>
                    <button onClick={() => { setTab('checkin'); openCheckIn(event.id) }} className="btn-primary text-xs py-1 px-3">Check-In</button>
                    <button onClick={() => handleDeleteEvent(event.id)} className="text-gray-400 hover:text-red-500 p-1"><Trash2 size={14} /></button>
                  </div>
                </div>

                {assignEventId === event.id && (
                  <div className="border-t border-gray-100 px-4 py-3 bg-gray-50">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="relative flex-1">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input type="text" className="input pl-9 text-sm" placeholder="Search volunteers to add..." value={assignSearch} onChange={(e) => setAssignSearch(e.target.value)} />
                      </div>
                    </div>

                    {assignSearch.length >= 2 && (
                      <div className="mb-3 max-h-40 overflow-y-auto space-y-1">
                        {users.filter((u) => (u.displayName || '').toLowerCase().includes(assignSearch.toLowerCase()) && !assignSignups.some((s) => s.userId === u.id)).slice(0, 8).map((u) => (
                          <button key={u.id} onClick={() => { handleAssignVolunteer(event.id, u.id, u.displayName); setAssignSearch('') }} className="w-full flex items-center justify-between p-2 bg-white rounded hover:bg-blue-50 text-sm">
                            <span>{u.displayName || u.email}{u.managed && <span className="ml-1 text-xs text-gray-400">(no account)</span>}</span>
                            <span className="text-primary-600 text-xs font-medium">+ Add to Event</span>
                          </button>
                        ))}
                        {users.filter((u) => (u.displayName || '').toLowerCase().includes(assignSearch.toLowerCase()) && !assignSignups.some((s) => s.userId === u.id)).length === 0 && (
                          <p className="text-xs text-gray-400 py-2 text-center">No matching volunteers</p>
                        )}
                      </div>
                    )}

                    {assignSignups.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-2">Assigned volunteers ({assignSignups.length})</p>
                        <div className="space-y-1">
                          {assignSignups.map((s) => (
                            <div key={s.id} className="flex items-center justify-between p-2 bg-white rounded text-sm">
                              <div className="flex items-center gap-2">
                                <span>{s.userName}</span>
                                {s.department && <span className="badge bg-primary-100 text-primary-700 text-xs">{getDeptInfo(s.department)?.icon} {getDeptInfo(s.department)?.name}</span>}
                                <span className={`badge text-xs ${s.status === 'checked_in' ? 'bg-green-100 text-green-700' : s.status === 'checked_out' ? 'bg-gray-100 text-gray-600' : 'bg-blue-100 text-blue-700'}`}>{s.status.replace('_', ' ')}</span>
                              </div>
                              {s.status === 'signed_up' && (
                                <button onClick={() => handleRemoveFromEvent(s.id, event.id)} className="text-gray-400 hover:text-red-500 p-1" title="Remove from event"><XCircle size={14} /></button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ministries Tab */}
      {tab === 'ministries' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="font-semibold text-lg">Manage Ministries</h2>
            <button onClick={() => setShowMinistryForm(!showMinistryForm)} className="btn-primary flex items-center space-x-1">
              <Plus size={16} />
              <span>New Ministry</span>
            </button>
          </div>

          {showMinistryForm && (
            <form onSubmit={handleSubmitMinistry} className="card space-y-4">
              <h3 className="font-semibold">Create Ministry</h3>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Name *</label>
                  <input className="input" required value={ministryForm.name}
                    onChange={(e) => setMinistryForm({ ...ministryForm, name: e.target.value })} />
                </div>
                <div>
                  <label className="label">Leader Name</label>
                  <input className="input" value={ministryForm.leaderName}
                    onChange={(e) => setMinistryForm({ ...ministryForm, leaderName: e.target.value })} />
                </div>
                <div className="sm:col-span-2">
                  <label className="label">Description</label>
                  <textarea className="input" rows={2} value={ministryForm.description}
                    onChange={(e) => setMinistryForm({ ...ministryForm, description: e.target.value })} />
                </div>
                <div>
                  <label className="label">Contact Email</label>
                  <input type="email" className="input" value={ministryForm.contactEmail}
                    onChange={(e) => setMinistryForm({ ...ministryForm, contactEmail: e.target.value })} />
                </div>
              </div>
              <div className="flex space-x-2">
                <button type="submit" className="btn-primary">Create Ministry</button>
                <button type="button" onClick={() => setShowMinistryForm(false)} className="btn-secondary">Cancel</button>
              </div>
            </form>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            {ministries.map((m) => (
              <div key={m.id} className="card flex justify-between items-start">
                <div>
                  <h3 className="font-semibold">{m.name}</h3>
                  {m.description && <p className="text-sm text-gray-500 mt-1">{m.description}</p>}
                  <p className="text-xs text-gray-400 mt-1">
                    {m.leaderName && `Led by ${m.leaderName}`}
                    {m.memberCount ? ` · ${m.memberCount} members` : ''}
                  </p>
                </div>
                <button onClick={() => handleDeleteMinistry(m.id)}
                  className="text-red-500 hover:text-red-700 p-1">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Users Tab */}
      {tab === 'users' && (
        <div className="space-y-4">
          <div className="flex flex-wrap justify-between items-center gap-2">
            <h2 className="font-semibold text-lg">Manage Users ({users.length})</h2>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setShowCSVImport(!showCSVImport)} className="btn-secondary flex items-center space-x-1">
                <Upload size={16} />
                <span>Import CSV</span>
              </button>
              <button onClick={() => setShowBulkInvite(true)} className="btn-secondary flex items-center space-x-1">
                <Mail size={16} />
                <span>Bulk Invite</span>
              </button>
              <button onClick={() => setShowVolunteerForm(!showVolunteerForm)} className="btn-primary flex items-center space-x-1">
                <UserPlus size={16} />
                <span>Add Volunteer</span>
              </button>
            </div>
          </div>

          {showVolunteerForm && (
            <form
              onSubmit={async (e) => {
                e.preventDefault()
                if (!volunteerForm.displayName.trim()) return toast.error('Name is required')
                try {
                  await createManagedVolunteer(volunteerForm)
                  setVolunteerForm({ displayName: '', email: '', phone: '' })
                  setShowVolunteerForm(false)
                  await loadData()
                  toast.success('Volunteer added')
                } catch (err) {
                  toast.error('Failed to create volunteer')
                }
              }}
              className="card space-y-4"
            >
              <h3 className="font-semibold">Add Volunteer (no account needed)</h3>
              <p className="text-xs text-gray-500">Create a profile for someone who doesn't have or want their own login. They can still be checked in/out and have hours tracked.</p>
              <div className="grid sm:grid-cols-3 gap-4">
                <div>
                  <label className="label">Name *</label>
                  <input
                    className="input"
                    required
                    value={volunteerForm.displayName}
                    onChange={(e) => setVolunteerForm({ ...volunteerForm, displayName: e.target.value })}
                    placeholder="John Doe"
                  />
                </div>
                <div>
                  <label className="label">Email (optional)</label>
                  <input
                    type="email"
                    className="input"
                    value={volunteerForm.email}
                    onChange={(e) => setVolunteerForm({ ...volunteerForm, email: e.target.value })}
                    placeholder="john@email.com"
                  />
                </div>
                <div>
                  <label className="label">Phone (optional)</label>
                  <input
                    type="tel"
                    className="input"
                    value={volunteerForm.phone}
                    onChange={(e) => setVolunteerForm({ ...volunteerForm, phone: e.target.value })}
                    placeholder="(555) 123-4567"
                  />
                </div>
              </div>
              <div className="flex space-x-2">
                <button type="submit" className="btn-primary">Add Volunteer</button>
                <button type="button" onClick={() => setShowVolunteerForm(false)} className="btn-secondary">Cancel</button>
              </div>
            </form>
          )}

          {showCSVImport && (
            <CSVImport onComplete={() => loadData()} />
          )}

          {showBulkInvite && (
            <BulkInviteModal
              volunteers={users}
              onClose={() => { setShowBulkInvite(false); loadData() }}
            />
          )}

          <div className="card p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3">Name</th>
                  <th className="text-left px-4 py-3 hidden sm:table-cell">Email</th>
                  <th className="text-right px-4 py-3">Hours</th>
                  <th className="text-left px-4 py-3">Role</th>
                  <th className="text-left px-4 py-3 hidden md:table-cell">Department</th>
                  <th className="text-right px-4 py-3 w-16"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div>
                        <span className="font-medium">{u.displayName || 'Unknown'}</span>
                        {u.managed && <span className="ml-2 badge bg-gray-100 text-gray-500">No account</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">{u.email || '-'}</td>
                    <td className="px-4 py-3 text-right">{formatHours(u.totalHours || 0)}</td>
                    <td className="px-4 py-3">
                      <select
                        className="input py-1 text-xs w-auto"
                        value={u.role}
                        onChange={(e) => handleRoleChange(u.id, e.target.value)}
                      >
                        <option value="volunteer">Volunteer</option>
                        <option value="ministry_leader">Ministry Leader</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {u.role === 'ministry_leader' ? (
                        <select
                          className="input py-1 text-xs w-auto"
                          value={u.assignedDepartment || ''}
                          onChange={async (e) => {
                            await updateVolunteerProfile(u.id, { assignedDepartment: e.target.value || null })
                            await loadData()
                          }}
                        >
                          <option value="">None</option>
                          {DEPARTMENTS.map((d) => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {u.managed && !u.claimToken && (
                          <button
                            onClick={async () => {
                              try {
                                const token = await generateClaimForVolunteer(u.id)
                                setClaimTokenModal({ userId: u.id, token })
                                await loadData()
                              } catch (err) {
                                toast.error('Failed to generate claim link')
                              }
                            }}
                            className="text-gray-400 hover:text-primary-600 p-1"
                            title="Generate claim link"
                          >
                            <LinkIcon size={14} />
                          </button>
                        )}
                        {u.managed && u.claimToken && (
                          <button
                            onClick={() => setClaimTokenModal({ userId: u.id, token: u.claimToken })}
                            className="text-primary-500 hover:text-primary-700 p-1"
                            title="Show QR code"
                          >
                            <QrCode size={14} />
                          </button>
                        )}
                        {u.managed && (
                          <button
                            onClick={async () => {
                              if (!await confirm({ title: 'Delete Volunteer', message: `Remove ${u.displayName}? This cannot be undone.`, confirmLabel: 'Delete', danger: true })) return
                              await deleteVolunteer(u.id)
                              await loadData()
                              toast.success(`${u.displayName} removed`)
                            }}
                            className="text-gray-400 hover:text-red-500 p-1"
                            title="Delete volunteer"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Check-In Tab */}
      {tab === 'checkin' && (
        <div className="space-y-4">
          <h2 className="font-semibold text-lg">Event Check-In</h2>
          <p className="text-sm text-gray-500">Select an event to manage volunteer attendance</p>

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {events
              .filter((e) => {
                const d = e.date?.toDate()
                const now = new Date()
                return d && d >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
              })
              .sort((a, b) => b.date.toDate() - a.date.toDate())
              .map((event) => {
                const isPast = event.date?.toDate() < new Date()
                return (
                  <div
                    key={event.id}
                    className={`card hover:shadow-md transition-shadow ${
                      checkInEventId === event.id ? 'ring-2 ring-primary-500' : ''
                    } ${isPast ? 'opacity-75' : ''}`}
                  >
                    <button onClick={() => openCheckIn(event.id)} className="w-full text-left">
                      <h3 className="font-semibold">{event.title}</h3>
                      <p className="text-sm text-gray-500">
                        {event.date?.toDate().toLocaleDateString('en-US', {
                          weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
                        })}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">{event.signupCount || 0} signups</p>
                    </button>
                    <button
                      onClick={() => navigate(`/kiosk/${event.id}`)}
                      className="mt-2 w-full btn-kiosk !text-sm !py-2 !min-h-[40px]"
                    >
                      Open Kiosk Mode
                    </button>
                  </div>
                )
              })}
          </div>

          {checkInEventId && (
            <div className="card">
              {/* Header with bulk actions */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div>
                  <h3 className="font-semibold text-lg">Attendance</h3>
                  <p className="text-xs text-gray-400">
                    {eventSignups.filter((s) => s.status === 'checked_in').length} checked in
                    {' · '}{eventSignups.filter((s) => s.status === 'checked_out').length} checked out
                    {' · '}{eventSignups.filter((s) => s.status === 'signed_up').length} pending
                    {eventSignups.filter((s) => s.status === 'released').length > 0 &&
                      ` · ${eventSignups.filter((s) => s.status === 'released').length} released`}
                    {eventSignups.filter((s) => s.status === 'no_show').length > 0 &&
                      ` · ${eventSignups.filter((s) => s.status === 'no_show').length} no-show`}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setShowAddVolunteer(!showAddVolunteer)}
                    className="btn-secondary text-xs py-1.5 px-3 flex items-center space-x-1"
                  >
                    <UserPlus size={12} />
                    <span>Add Walk-In</span>
                  </button>
                  {eventSignups.some((s) => s.status === 'signed_up') && (
                    <button
                      onClick={handleBulkCheckIn}
                      disabled={bulkLoading}
                      className="btn-primary text-xs py-1.5 px-3 flex items-center space-x-1"
                    >
                      <UserCheck size={12} />
                      <span>{bulkLoading ? '...' : 'Check All In'}</span>
                    </button>
                  )}
                  {eventSignups.some((s) => s.status === 'checked_in') && (
                    <button
                      onClick={handleBulkCheckOut}
                      disabled={bulkLoading}
                      className="btn-secondary text-xs py-1.5 px-3 flex items-center space-x-1"
                    >
                      <UserX size={12} />
                      <span>{bulkLoading ? '...' : 'Check All Out'}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Add Walk-In Volunteer */}
              {showAddVolunteer && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm font-medium text-blue-800 mb-2">Add a walk-in volunteer</p>
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      className="input pl-9 text-sm"
                      placeholder="Search by name..."
                      value={volunteerSearch}
                      onChange={(e) => setVolunteerSearch(e.target.value)}
                    />
                  </div>
                  {volunteerSearch.length >= 2 && (
                    <div className="mt-2 max-h-40 overflow-y-auto space-y-1">
                      {users
                        .filter((u) =>
                          (u.displayName || '').toLowerCase().includes(volunteerSearch.toLowerCase()) &&
                          !eventSignups.some((s) => s.userId === u.id)
                        )
                        .slice(0, 8)
                        .map((u) => (
                          <button
                            key={u.id}
                            onClick={() => handleAddWalkIn(u.id, u.displayName)}
                            className="w-full flex items-center justify-between p-2 bg-white rounded hover:bg-gray-50 text-sm"
                          >
                            <span>{u.displayName || u.email}</span>
                            <span className="text-primary-600 text-xs font-medium">+ Add & Check In</span>
                          </button>
                        ))}
                      {users.filter((u) =>
                        (u.displayName || '').toLowerCase().includes(volunteerSearch.toLowerCase()) &&
                        !eventSignups.some((s) => s.userId === u.id)
                      ).length === 0 && (
                        <p className="text-xs text-gray-400 py-2 text-center">No matching volunteers found</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Volunteer List */}
              {eventSignups.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-4">No signups for this event</p>
              ) : (
                <div className="space-y-2">
                  {eventSignups
                    .sort((a, b) => {
                      const order = { checked_in: 0, signed_up: 1, checked_out: 2, released: 3, no_show: 4 }
                      return (order[a.status] || 5) - (order[b.status] || 5)
                    })
                    .map((signup) => (
                    <div key={signup.id} className={`p-3 rounded-lg ${
                      signup.status === 'checked_in' ? 'bg-green-50 border border-green-200' :
                      signup.status === 'no_show' ? 'bg-red-50 border border-red-100' :
                      signup.status === 'released' ? 'bg-yellow-50 border border-yellow-100' :
                      'bg-gray-50'
                    }`}>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="min-w-0">
                            <p className="font-medium text-sm">{signup.userName}</p>
                            <p className="text-xs text-gray-400 capitalize">
                              {signup.status.replace('_', ' ')}
                              {signup.status === 'checked_in' && signup.checkedInAt && (
                                <span> since {signup.checkedInAt.toDate().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
                              )}
                            </p>
                          </div>
                          {/* Department assignment */}
                          {(signup.status === 'signed_up' || signup.status === 'checked_in') && (
                            <select
                              className="input py-1 text-xs w-auto"
                              value={signup.department || ''}
                              onChange={async (e) => {
                                await assignDepartment(signup.id, e.target.value)
                                await refreshSignups()
                              }}
                            >
                              <option value="">Assign dept...</option>
                              {DEPARTMENTS.map((d) => (
                                <option key={d.id} value={d.id}>{d.icon} {d.name}</option>
                              ))}
                            </select>
                          )}
                          {(signup.status === 'checked_out' || signup.status === 'released') && signup.department && (
                            <span className="badge bg-primary-100 text-primary-700 text-xs">
                              {DEPARTMENTS.find((d) => d.id === signup.department)?.icon} {DEPARTMENTS.find((d) => d.id === signup.department)?.name}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {/* Signed up: Check In, No-Show */}
                          {signup.status === 'signed_up' && (
                            <>
                              <button
                                onClick={() => handleCheckIn(signup.id)}
                                disabled={checkInLoading === signup.id}
                                className="btn-primary text-xs py-1 px-3 flex items-center space-x-1"
                              >
                                <UserCheck size={12} />
                                <span>{checkInLoading === signup.id ? '...' : 'Check In'}</span>
                              </button>
                              <button
                                onClick={() => handleNoShow(signup.id)}
                                disabled={checkInLoading === signup.id}
                                className="text-gray-400 hover:text-red-500 p-1"
                                title="Mark as no-show"
                              >
                                <XCircle size={16} />
                              </button>
                            </>
                          )}

                          {/* Checked in: manual hours + Check Out + Release */}
                          {signup.status === 'checked_in' && (
                            <>
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  step="0.25"
                                  min="0"
                                  className="input py-1 text-xs w-16 text-center"
                                  placeholder="hrs"
                                  value={manualHoursMap[signup.id] || ''}
                                  onChange={(e) => setManualHours(signup.id, e.target.value)}
                                  title="Override hours (leave blank for auto-calculate)"
                                />
                              </div>
                              <button
                                onClick={() => handleCheckOut(signup.id, signup.userId)}
                                disabled={checkInLoading === signup.id}
                                className="btn-primary text-xs py-1 px-3 flex items-center space-x-1"
                              >
                                <UserX size={12} />
                                <span>{checkInLoading === signup.id ? '...' : 'Check Out'}</span>
                              </button>
                              <button
                                onClick={() => handleRelease(signup.id)}
                                disabled={checkInLoading === signup.id}
                                className="text-gray-400 hover:text-amber-500 p-1"
                                title="Release (not needed, 0 hours)"
                              >
                                <MinusCircle size={16} />
                              </button>
                            </>
                          )}

                          {/* Checked out: show hours */}
                          {signup.status === 'checked_out' && (
                            <span className="text-xs text-green-600 font-medium">
                              {formatHours(signup.hoursLogged)} logged
                            </span>
                          )}

                          {/* Released */}
                          {signup.status === 'released' && (
                            <span className="text-xs text-amber-600 font-medium">Released</span>
                          )}

                          {/* No-show */}
                          {signup.status === 'no_show' && (
                            <span className="text-xs text-red-500 font-medium">No-show</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Audit Log Tab */}
      {tab === 'auditlog' && (
        <div className="space-y-4">
          <h2 className="font-semibold text-lg">Audit Log</h2>
          <p className="text-sm text-gray-500">Recent admin and system actions</p>
          <AuditLogViewer />
        </div>
      )}

      {/* Settings Tab */}
      {tab === 'settings' && (
        <div className="max-w-2xl">
          <BrandingSettings />
        </div>
      )}

      {/* Claim Token Modal */}
      {claimTokenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setClaimTokenModal(null)}>
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg">Claim Link</h3>
              <button onClick={() => setClaimTokenModal(null)} className="text-gray-400 hover:text-gray-600 p-1">
                <XCircle size={20} />
              </button>
            </div>
            <ClaimQRCode token={claimTokenModal.token} />
          </div>
        </div>
      )}

      {ConfirmDialog}
    </div>
  )
}
