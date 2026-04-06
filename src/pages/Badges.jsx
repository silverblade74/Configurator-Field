import { useAuth } from '../contexts/AuthContext'
import { BADGE_DEFINITIONS, MILESTONES } from '../services/firestore'
import { formatHours } from '../utils/gamification'
import { Award, Lock, Check, Target } from 'lucide-react'

export default function Badges() {
  const { userProfile } = useAuth()
  const earnedBadgeIds = userProfile?.badges || []

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Badges & Milestones</h1>
        <p className="text-gray-500 text-sm mt-1">
          Earn badges by volunteering, maintaining streaks, and hitting milestones
        </p>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-4 flex items-center space-x-2">
          <Award size={20} className="text-yellow-500" />
          <span>Badges ({earnedBadgeIds.length} / {BADGE_DEFINITIONS.length})</span>
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {BADGE_DEFINITIONS.map((badge) => {
            const earned = earnedBadgeIds.includes(badge.id)
            return (
              <div
                key={badge.id}
                className={`card flex items-center space-x-4 ${
                  earned ? 'border-yellow-300 bg-yellow-50' : 'opacity-60'
                }`}
              >
                <span className="text-3xl">{badge.icon}</span>
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <h3 className="font-semibold">{badge.name}</h3>
                    {earned ? (
                      <Check size={16} className="text-green-600" />
                    ) : (
                      <Lock size={14} className="text-gray-400" />
                    )}
                  </div>
                  <p className="text-sm text-gray-500">{badge.description}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-4 flex items-center space-x-2">
          <Target size={20} className="text-primary-500" />
          <span>Hour Milestones</span>
        </h2>
        <div className="card p-0 overflow-hidden">
          <div className="divide-y divide-gray-100">
            {MILESTONES.map((milestone) => {
              const reached = (userProfile?.totalHours || 0) >= milestone.hours
              const progress = Math.min(
                ((userProfile?.totalHours || 0) / milestone.hours) * 100,
                100
              )

              return (
                <div key={milestone.hours} className="px-4 py-4">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center space-x-3">
                      {reached ? (
                        <Check size={16} className="text-green-600" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
                      )}
                      <div>
                        <p className={`font-medium text-sm ${reached ? 'text-green-700' : ''}`}>
                          {milestone.name}
                        </p>
                        <p className="text-xs text-gray-500">{milestone.message}</p>
                      </div>
                    </div>
                    <span className="text-sm font-medium text-gray-500">
                      {formatHours(Math.min(userProfile?.totalHours || 0, milestone.hours))} / {milestone.hours}h
                    </span>
                  </div>
                  <div className="ml-7 mt-2">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${reached ? 'bg-green-500' : 'bg-primary-500'}`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
