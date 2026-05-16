import { UserCheck, UserX, MinusCircle } from 'lucide-react'
import { DEPARTMENTS } from '../utils/departments'
import { formatHours } from '../utils/gamification'

export default function KioskVolunteerRow({ signup, onCheckIn, onCheckOut, onRelease, onDepartmentChange, loading }) {
  const statusColors = {
    signed_up: 'bg-white border border-gray-200',
    checked_in: 'bg-green-50 border-2 border-green-300',
    checked_out: 'bg-gray-50 border border-gray-100 opacity-60',
    released: 'bg-yellow-50 border border-yellow-200 opacity-60',
    no_show: 'bg-red-50 border border-red-100 opacity-60',
  }

  const isActive = signup.status === 'signed_up' || signup.status === 'checked_in'

  return (
    <div className={`rounded-xl p-4 transition-all ${statusColors[signup.status] || 'bg-white border'}`}>
      <div className="flex items-center justify-between gap-3">
        {/* Name + Status */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-sm font-bold text-gray-600 shrink-0">
            {signup.userName?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-base truncate">{signup.userName}</p>
            <p className="text-xs text-gray-400 capitalize">
              {signup.status.replace('_', ' ')}
              {signup.status === 'checked_in' && signup.checkedInAt && (
                <span> · {signup.checkedInAt.toDate().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
              )}
              {signup.status === 'checked_out' && signup.hoursLogged > 0 && (
                <span> · {formatHours(signup.hoursLogged)}</span>
              )}
            </p>
          </div>
        </div>

        {/* Department */}
        {isActive && (
          <select
            className="input py-1.5 text-sm w-auto max-w-[140px] shrink-0"
            value={signup.department || ''}
            onChange={(e) => onDepartmentChange(signup.id, e.target.value)}
          >
            <option value="">Dept...</option>
            {DEPARTMENTS.map((d) => (
              <option key={d.id} value={d.id}>{d.icon} {d.name}</option>
            ))}
          </select>
        )}

        {!isActive && signup.department && (
          <span className="badge bg-primary-100 text-primary-700 shrink-0">
            {DEPARTMENTS.find((d) => d.id === signup.department)?.icon} {DEPARTMENTS.find((d) => d.id === signup.department)?.name}
          </span>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {signup.status === 'signed_up' && (
            <button
              onClick={() => onCheckIn(signup.id)}
              disabled={loading}
              className="btn-kiosk !py-2 !px-4 !text-base !min-h-[44px]"
            >
              <UserCheck size={18} className="inline mr-1" />
              {loading ? '...' : 'In'}
            </button>
          )}

          {signup.status === 'checked_in' && (
            <>
              <button
                onClick={() => onCheckOut(signup.id, signup.userId)}
                disabled={loading}
                className="bg-gray-700 text-white px-4 py-2 rounded-xl font-semibold hover:bg-gray-800 transition-colors min-h-[44px]"
              >
                <UserX size={18} className="inline mr-1" />
                {loading ? '...' : 'Out'}
              </button>
              <button
                onClick={() => onRelease(signup.id)}
                disabled={loading}
                className="text-gray-400 hover:text-amber-500 p-2"
                title="Release"
              >
                <MinusCircle size={20} />
              </button>
            </>
          )}

          {signup.status === 'checked_out' && (
            <span className="text-sm text-green-600 font-medium">{formatHours(signup.hoursLogged)}</span>
          )}

          {signup.status === 'released' && (
            <span className="text-sm text-amber-600 font-medium">Released</span>
          )}
        </div>
      </div>
    </div>
  )
}
