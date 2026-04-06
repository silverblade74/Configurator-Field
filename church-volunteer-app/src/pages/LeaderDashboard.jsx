import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { getAllUsers, getMinistries, getEvents, getEventSignups } from '../services/firestore'
import { formatHours } from '../utils/gamification'
import { DEPARTMENTS } from '../utils/departments'
import StatCard from '../components/StatCard'
import EmptyState from '../components/EmptyState'
import {
  Users, Clock, Calendar, ChevronDown, ChevronUp,
  Search, Mail, Phone, TrendingUp, UserCheck, AlertCircle,
} from 'lucide-react'

export default function LeaderDashboard() {
  const { userProfile } = useAuth()
  const [users, setUsers] = useState([])
  const [ministries, setMinistries] = useState([])
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedDept, setExpandedDept] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedDept, setSelectedDept] = useState('all')
  const [eventSignupsMap, setEventSignupsMap] = useState({})

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const [usersData, ministriesData, eventsData] = await Promise.all([
        getAllUsers(),
        getMinistries(),
        getEvents(),
      ])
      setUsers(usersData)
      setMinistries(ministriesData)
      setEvents(eventsData)

      // Load signups for upcoming events
      const upcoming = eventsData.filter((e) => e.date?.toDate() > new Date()).slice(0, 10)
      const signupsMap = {}
      await Promise.all(
        upcoming.map(async (event) => {
          const signups = await getEventSignups(event.id)
          signupsMap[event.id] = signups
        })
      )
      setEventSignupsMap(signupsMap)
    } catch (err) {
      console.error('Error loading leader data:', err)
    }
    setLoading(false)
  }

  // Map ministries to departments by name matching
  function getMinistryForDept(dept) {
    return ministries.find(
      (m) => m.name.toLowerCase().trim() === dept.name.toLowerCase().trim()
    )
  }

  // Get volunteers assigned to a ministry
  function getVolunteersForMinistry(ministryId) {
    if (!ministryId) return []
    return users.filter(
      (u) => u.ministries && u.ministries.includes(ministryId)
    )
  }

  // Get all volunteers with their department assignments
  function getDepartmentData() {
    return DEPARTMENTS.map((dept) => {
      const ministry = getMinistryForDept(dept)
      const volunteers = ministry ? getVolunteersForMinistry(ministry.id) : []
      const totalHours = volunteers.reduce((sum, v) => sum + (v.totalHours || 0), 0)
      const upcomingEventCount = ministry
        ? events.filter((e) => e.ministryId === ministry.id && e.date?.toDate() > new Date()).length
        : 0

      return {
        ...dept,
        ministry,
        volunteers,
        totalHours,
        upcomingEventCount,
      }
    })
  }

  const departmentData = getDepartmentData()
  const totalVolunteers = users.filter((u) => u.role === 'volunteer').length
  const assignedVolunteers = new Set(departmentData.flatMap((d) => d.volunteers.map((v) => v.id))).size
  const unassignedCount = totalVolunteers - assignedVolunteers
  const totalDeptHours = departmentData.reduce((sum, d) => sum + d.totalHours, 0)

  // Filter departments
  const filteredDepartments = departmentData.filter((dept) => {
    if (selectedDept !== 'all' && dept.id !== selectedDept) return false
    return true
  })

  // Search volunteers across departments
  const searchResults = searchQuery.length >= 2
    ? users.filter((u) =>
        (u.displayName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.email || '').toLowerCase().includes(searchQuery.toLowerCase())
      )
    : []

  function getVolunteerDepartments(userId) {
    return departmentData
      .filter((d) => d.volunteers.some((v) => v.id === userId))
      .map((d) => d.name)
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Leader Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">
          Serve Coordinators & Ministry Leaders — volunteer assignments by department
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Volunteers" value={totalVolunteers} icon={Users} color="primary" />
        <StatCard title="Assigned" value={assignedVolunteers} subtitle={`${unassignedCount} unassigned`} icon={UserCheck} color="green" />
        <StatCard title="Total Dept Hours" value={formatHours(totalDeptHours)} icon={Clock} color="orange" />
        <StatCard title="Departments" value={DEPARTMENTS.length} icon={TrendingUp} color="purple" />
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            className="input pl-9"
            placeholder="Search volunteers by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <select
          className="input w-auto"
          value={selectedDept}
          onChange={(e) => setSelectedDept(e.target.value)}
        >
          <option value="all">All Departments</option>
          {DEPARTMENTS.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      </div>

      {/* Search Results */}
      {searchQuery.length >= 2 && (
        <div className="card">
          <h2 className="font-semibold text-lg mb-3">
            Search Results ({searchResults.length})
          </h2>
          {searchResults.length === 0 ? (
            <p className="text-gray-400 text-sm">No volunteers found matching "{searchQuery}"</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {searchResults.slice(0, 20).map((user) => {
                const depts = getVolunteerDepartments(user.id)
                return (
                  <div key={user.id} className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="flex items-center space-x-3">
                      <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center text-sm font-bold text-primary-600">
                        {user.displayName?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{user.displayName || 'Unknown'}</p>
                        <p className="text-xs text-gray-400">{user.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-12 sm:ml-0">
                      {depts.length > 0 ? (
                        depts.map((d) => (
                          <span key={d} className="badge bg-primary-100 text-primary-700">{d}</span>
                        ))
                      ) : (
                        <span className="badge bg-gray-100 text-gray-500">Unassigned</span>
                      )}
                      <span className="text-xs text-gray-400">{formatHours(user.totalHours || 0)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Unassigned Volunteers Alert */}
      {unassignedCount > 0 && selectedDept === 'all' && !searchQuery && (
        <div className="flex items-start space-x-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <AlertCircle size={20} className="text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium text-amber-800 text-sm">
              {unassignedCount} volunteer{unassignedCount !== 1 ? 's' : ''} not assigned to a department
            </p>
            <p className="text-xs text-amber-600 mt-0.5">
              Assign them via Admin &rarr; Users, or add ministry IDs to their profile.
            </p>
          </div>
        </div>
      )}

      {/* Department Cards */}
      <div className="space-y-3">
        {filteredDepartments.map((dept) => {
          const isExpanded = expandedDept === dept.id
          return (
            <div key={dept.id} className="card p-0 overflow-hidden">
              {/* Department Header */}
              <button
                onClick={() => setExpandedDept(isExpanded ? null : dept.id)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">{dept.icon}</span>
                  <div className="text-left">
                    <h3 className="font-semibold">{dept.name}</h3>
                    <p className="text-xs text-gray-500">
                      {dept.volunteers.length} volunteer{dept.volunteers.length !== 1 ? 's' : ''}
                      {dept.totalHours > 0 && ` · ${formatHours(dept.totalHours)} total`}
                      {dept.upcomingEventCount > 0 && ` · ${dept.upcomingEventCount} upcoming event${dept.upcomingEventCount !== 1 ? 's' : ''}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <span className={`badge ${dept.color}`}>
                    {dept.volunteers.length}
                  </span>
                  {isExpanded ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
                </div>
              </button>

              {/* Expanded Volunteer List */}
              {isExpanded && (
                <div className="border-t border-gray-100">
                  {dept.volunteers.length === 0 ? (
                    <div className="px-5 py-6 text-center">
                      <p className="text-gray-400 text-sm">No volunteers assigned to this department yet.</p>
                      {!dept.ministry && (
                        <p className="text-xs text-amber-600 mt-1">
                          Create a ministry named "{dept.name}" in Admin to start assigning volunteers.
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-50">
                      {/* Column Headers */}
                      <div className="px-5 py-2 bg-gray-50 flex items-center text-xs font-medium text-gray-500 uppercase">
                        <span className="flex-1">Volunteer</span>
                        <span className="w-20 text-right hidden sm:block">Hours</span>
                        <span className="w-20 text-right hidden sm:block">Points</span>
                        <span className="w-20 text-right hidden md:block">Streak</span>
                        <span className="w-24 text-right">Status</span>
                      </div>

                      {dept.volunteers
                        .sort((a, b) => (b.totalHours || 0) - (a.totalHours || 0))
                        .map((vol) => {
                          const isActive = vol.lastServedDate?.toDate() > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
                          return (
                            <div key={vol.id} className="px-5 py-3 flex items-center hover:bg-gray-50">
                              <div className="flex-1 flex items-center space-x-3 min-w-0">
                                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600 shrink-0">
                                  {vol.displayName?.charAt(0)?.toUpperCase() || '?'}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-medium text-sm truncate">{vol.displayName || 'Unknown'}</p>
                                  <div className="flex items-center space-x-2 text-xs text-gray-400">
                                    {vol.email && (
                                      <span className="flex items-center space-x-1 truncate">
                                        <Mail size={10} />
                                        <span className="truncate">{vol.email}</span>
                                      </span>
                                    )}
                                    {vol.phone && (
                                      <span className="flex items-center space-x-1 hidden lg:flex">
                                        <Phone size={10} />
                                        <span>{vol.phone}</span>
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <span className="w-20 text-right text-sm hidden sm:block">
                                {formatHours(vol.totalHours || 0)}
                              </span>
                              <span className="w-20 text-right text-sm hidden sm:block">
                                {vol.totalPoints || 0}
                              </span>
                              <span className="w-20 text-right text-sm hidden md:block">
                                {vol.streak || 0}w
                              </span>
                              <span className="w-24 text-right">
                                <span className={`badge ${isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                  {isActive ? 'Active' : 'Inactive'}
                                </span>
                              </span>
                            </div>
                          )
                        })}
                    </div>
                  )}

                  {/* Department Summary Footer */}
                  {dept.volunteers.length > 0 && (
                    <div className="px-5 py-3 bg-gray-50 flex items-center justify-between text-xs text-gray-500">
                      <span>
                        {dept.volunteers.filter((v) => {
                          const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
                          return v.lastServedDate?.toDate() > cutoff
                        }).length} active in last 30 days
                      </span>
                      <span>
                        Avg: {formatHours(dept.totalHours / dept.volunteers.length)} per volunteer
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Upcoming Events by Department */}
      {selectedDept === 'all' && !searchQuery && (
        <div className="card">
          <h2 className="font-semibold text-lg mb-4">Upcoming Events by Department</h2>
          {events.filter((e) => e.date?.toDate() > new Date()).length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-4">No upcoming events</p>
          ) : (
            <div className="space-y-3">
              {events
                .filter((e) => e.date?.toDate() > new Date())
                .sort((a, b) => a.date.toDate() - b.date.toDate())
                .slice(0, 10)
                .map((event) => {
                  const ministry = ministries.find((m) => m.id === event.ministryId)
                  const dept = ministry
                    ? DEPARTMENTS.find((d) => d.name.toLowerCase().trim() === ministry.name.toLowerCase().trim())
                    : null
                  const signups = eventSignupsMap[event.id] || []

                  return (
                    <div key={event.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <span className="text-lg">{dept?.icon || '📅'}</span>
                        <div>
                          <p className="font-medium text-sm">{event.title}</p>
                          <p className="text-xs text-gray-500">
                            {event.date?.toDate().toLocaleDateString('en-US', {
                              weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
                            })}
                            {ministry && ` · ${ministry.name}`}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{signups.length} signed up</p>
                        {event.maxVolunteers && (
                          <p className="text-xs text-gray-400">of {event.maxVolunteers} needed</p>
                        )}
                      </div>
                    </div>
                  )
                })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
