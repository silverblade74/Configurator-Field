import { DEPARTMENTS } from '../utils/departments'

export default function KioskDepartmentFill({ signups }) {
  const deptCounts = {}
  for (const s of signups) {
    if (s.department && (s.status === 'checked_in' || s.status === 'signed_up')) {
      deptCounts[s.department] = (deptCounts[s.department] || 0) + 1
    }
  }

  const activeDepts = DEPARTMENTS.filter((d) => deptCounts[d.id] > 0)
  if (activeDepts.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2">
      {activeDepts.map((dept) => {
        const count = deptCounts[dept.id] || 0
        return (
          <div
            key={dept.id}
            className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg px-3 py-1.5"
          >
            <span className="text-sm">{dept.icon}</span>
            <span className="text-sm font-medium text-gray-700">{dept.name}</span>
            <span className="text-sm font-bold text-primary-600">{count}</span>
          </div>
        )
      })}
    </div>
  )
}
