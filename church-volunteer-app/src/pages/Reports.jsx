import { useState } from 'react'
import { useToast } from '../components/ToastProvider'
import { getAttendanceLogs, getServiceHoursSummary, getAllUsers, getEvents } from '../services/firestore'
import { exportToCSV } from '../utils/csvExport'
import { formatHours } from '../utils/gamification'
import { FileText, Download, Search } from 'lucide-react'

const REPORT_TYPES = [
  { id: 'attendance_summary', label: 'Attendance Summary' },
  { id: 'hours_by_volunteer', label: 'Hours by Volunteer' },
  { id: 'hours_by_department', label: 'Hours by Department' },
  { id: 'event_attendance', label: 'Event Attendance' },
]

export default function Reports() {
  const toast = useToast()
  const [reportType, setReportType] = useState('attendance_summary')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [rows, setRows] = useState([])
  const [columns, setColumns] = useState([])
  const [loading, setLoading] = useState(false)
  const [generated, setGenerated] = useState(false)

  async function generateReport() {
    setLoading(true)
    setGenerated(false)
    try {
      const from = dateFrom ? new Date(dateFrom) : null
      const to = dateTo ? new Date(dateTo + 'T23:59:59') : null

      if (reportType === 'attendance_summary') {
        const logs = await getAttendanceLogs()
        const filtered = filterByDate(logs, from, to, 'createdAt')
        const cols = ['Date', 'User ID', 'Event ID', 'Hours', 'Check In', 'Check Out']
        const data = filtered.map((l) => ({
          Date: formatTs(l.createdAt),
          'User ID': l.userId || '',
          'Event ID': l.eventId || '',
          Hours: l.hoursLogged ?? 0,
          'Check In': formatTs(l.checkedInAt),
          'Check Out': formatTs(l.checkedOutAt),
        }))
        setColumns(cols)
        setRows(data)
      } else if (reportType === 'hours_by_volunteer') {
        const [users, serviceHours] = await Promise.all([getAllUsers(), getServiceHoursSummary()])
        const filtered = filterByDate(serviceHours, from, to, 'date')
        const byUser = {}
        for (const h of filtered) {
          if (!byUser[h.userId]) byUser[h.userId] = { hours: 0, points: 0, count: 0 }
          byUser[h.userId].hours += h.hours || 0
          byUser[h.userId].points += h.points || 0
          byUser[h.userId].count += 1
        }
        const userMap = Object.fromEntries(users.map((u) => [u.id, u]))
        const cols = ['Volunteer', 'Email', 'Total Hours', 'Total Points', 'Events Served']
        const data = Object.entries(byUser)
          .sort((a, b) => b[1].hours - a[1].hours)
          .map(([uid, d]) => ({
            Volunteer: userMap[uid]?.displayName || uid,
            Email: userMap[uid]?.email || '',
            'Total Hours': Number(d.hours.toFixed(2)),
            'Total Points': d.points,
            'Events Served': d.count,
          }))
        setColumns(cols)
        setRows(data)
      } else if (reportType === 'hours_by_department') {
        const serviceHours = await getServiceHoursSummary()
        const events = await getEvents()
        const eventMap = Object.fromEntries(events.map((e) => [e.id, e]))
        const filtered = filterByDate(serviceHours, from, to, 'date')
        const byDept = {}
        for (const h of filtered) {
          const event = eventMap[h.eventId]
          const dept = event?.ministryId || 'General'
          if (!byDept[dept]) byDept[dept] = { hours: 0, points: 0, count: 0 }
          byDept[dept].hours += h.hours || 0
          byDept[dept].points += h.points || 0
          byDept[dept].count += 1
        }
        const cols = ['Department', 'Total Hours', 'Total Points', 'Check-outs']
        const data = Object.entries(byDept)
          .sort((a, b) => b[1].hours - a[1].hours)
          .map(([dept, d]) => ({
            Department: dept === 'General' ? 'General' : dept,
            'Total Hours': Number(d.hours.toFixed(2)),
            'Total Points': d.points,
            'Check-outs': d.count,
          }))
        setColumns(cols)
        setRows(data)
      } else if (reportType === 'event_attendance') {
        const [events, logs] = await Promise.all([getEvents(), getAttendanceLogs()])
        const filtered = filterByDate(logs, from, to, 'createdAt')
        const byEvent = {}
        for (const l of filtered) {
          if (!byEvent[l.eventId]) byEvent[l.eventId] = { count: 0, hours: 0 }
          byEvent[l.eventId].count += 1
          byEvent[l.eventId].hours += l.hoursLogged || 0
        }
        const eventMap = Object.fromEntries(events.map((e) => [e.id, e]))
        const cols = ['Event', 'Date', 'Attendees', 'Total Hours']
        const data = Object.entries(byEvent)
          .sort((a, b) => b[1].hours - a[1].hours)
          .map(([eid, d]) => ({
            Event: eventMap[eid]?.title || eid,
            Date: eventMap[eid]?.date ? formatTs(eventMap[eid].date) : '',
            Attendees: d.count,
            'Total Hours': Number(d.hours.toFixed(2)),
          }))
        setColumns(cols)
        setRows(data)
      }

      setGenerated(true)
      toast.success('Report generated')
    } catch (err) {
      console.error('Report error:', err)
      toast.error('Failed to generate report')
    }
    setLoading(false)
  }

  function handleExport() {
    if (rows.length === 0) return toast.error('No data to export')
    const label = REPORT_TYPES.find((r) => r.id === reportType)?.label || 'report'
    const filename = `${label.replace(/\s+/g, '_').toLowerCase()}_${new Date().toISOString().slice(0, 10)}.csv`
    exportToCSV(rows, filename)
    toast.success('CSV downloaded')
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <FileText size={24} /> Reports
      </h1>

      {/* Controls */}
      <div className="card space-y-4">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="label">Report Type</label>
            <select
              className="input"
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
            >
              {REPORT_TYPES.map((r) => (
                <option key={r.id} value={r.id}>{r.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">From Date</label>
            <input
              type="date"
              className="input"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div>
            <label className="label">To Date</label>
            <input
              type="date"
              className="input"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
          <div className="flex items-end gap-2">
            <button
              onClick={generateReport}
              disabled={loading}
              className="btn-primary flex items-center gap-1"
            >
              <Search size={16} />
              {loading ? 'Generating...' : 'Generate Report'}
            </button>
          </div>
        </div>
      </div>

      {/* Results */}
      {generated && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">{rows.length} record{rows.length !== 1 ? 's' : ''} found</p>
            <button
              onClick={handleExport}
              disabled={rows.length === 0}
              className="btn-secondary flex items-center gap-1 text-sm"
            >
              <Download size={16} />
              Export CSV
            </button>
          </div>

          {rows.length === 0 ? (
            <div className="card text-center py-8">
              <p className="text-gray-400">No data matching the selected criteria.</p>
            </div>
          ) : (
            <div className="card p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      {columns.map((col) => (
                        <th key={col} className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {rows.map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        {columns.map((col) => (
                          <td key={col} className="px-4 py-2 whitespace-nowrap">
                            {typeof row[col] === 'number' && col.toLowerCase().includes('hour')
                              ? formatHours(row[col])
                              : row[col]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Helpers ─────────────────────────────────────────────────

function formatTs(ts) {
  if (!ts) return ''
  const d = typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts)
  return d.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

function filterByDate(items, from, to, field) {
  return items.filter((item) => {
    const raw = item[field]
    if (!raw) return !from && !to // include if no filters
    const d = typeof raw.toDate === 'function' ? raw.toDate() : new Date(raw)
    if (from && d < from) return false
    if (to && d > to) return false
    return true
  })
}
