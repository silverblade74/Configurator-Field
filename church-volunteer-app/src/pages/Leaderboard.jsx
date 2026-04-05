import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { getLeaderboard } from '../services/firestore'
import { formatHours, getLevel } from '../utils/gamification'
import EmptyState from '../components/EmptyState'
import { Trophy, Medal, Crown, TrendingUp } from 'lucide-react'

export default function Leaderboard() {
  const { userProfile } = useAuth()
  const [leaders, setLeaders] = useState([])
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState('points') // points | hours

  useEffect(() => {
    async function load() {
      try {
        const data = await getLeaderboard(50)
        setLeaders(data)
      } catch (err) {
        console.error('Error loading leaderboard:', err)
      }
      setLoading(false)
    }
    load()
  }, [])

  const sorted = [...leaders].sort((a, b) =>
    sortBy === 'points'
      ? (b.totalPoints || 0) - (a.totalPoints || 0)
      : (b.totalHours || 0) - (a.totalHours || 0)
  )

  function getRankIcon(rank) {
    if (rank === 1) return <Crown size={20} className="text-yellow-500" />
    if (rank === 2) return <Medal size={20} className="text-gray-400" />
    if (rank === 3) return <Medal size={20} className="text-orange-400" />
    return <span className="text-sm font-bold text-gray-400 w-5 text-center">{rank}</span>
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Leaderboard</h1>
          <p className="text-gray-500 text-sm">See who's making the biggest impact</p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setSortBy('points')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              sortBy === 'points' ? 'bg-primary-100 text-primary-700' : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            By Points
          </button>
          <button
            onClick={() => setSortBy('hours')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              sortBy === 'hours' ? 'bg-primary-100 text-primary-700' : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            By Hours
          </button>
        </div>
      </div>

      {sorted.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="No volunteers yet"
          description="The leaderboard will populate as volunteers serve."
        />
      ) : (
        <>
          {/* Top 3 Podium */}
          {sorted.length >= 3 && (
            <div className="grid grid-cols-3 gap-4">
              {[sorted[1], sorted[0], sorted[2]].map((user, idx) => {
                const rank = idx === 0 ? 2 : idx === 1 ? 1 : 3
                const level = getLevel(user?.totalPoints || 0)
                const isMe = user?.uid === userProfile?.uid
                return (
                  <div
                    key={user?.id || idx}
                    className={`card text-center ${rank === 1 ? 'ring-2 ring-yellow-400 bg-yellow-50' : ''} ${isMe ? 'ring-2 ring-primary-400' : ''}`}
                  >
                    <div className="flex justify-center mb-2">{getRankIcon(rank)}</div>
                    <div className="w-12 h-12 mx-auto rounded-full bg-gray-200 flex items-center justify-center text-lg font-bold text-gray-600">
                      {user?.displayName?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <p className="font-semibold mt-2 text-sm truncate">{user?.displayName}</p>
                    <p className={`text-xs ${level.color}`}>{level.name}</p>
                    <div className="mt-2 text-sm">
                      <p className="font-bold">{sortBy === 'points' ? `${user?.totalPoints || 0} pts` : formatHours(user?.totalHours || 0)}</p>
                      <p className="text-xs text-gray-400">
                        {sortBy === 'points' ? formatHours(user?.totalHours || 0) : `${user?.totalPoints || 0} pts`}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Full List */}
          <div className="card overflow-hidden p-0">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Rank</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Volunteer</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Hours</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Points</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">Level</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sorted.map((user, idx) => {
                  const level = getLevel(user.totalPoints || 0)
                  const isMe = user.uid === userProfile?.uid
                  return (
                    <tr key={user.id} className={isMe ? 'bg-primary-50' : 'hover:bg-gray-50'}>
                      <td className="px-4 py-3 w-12">
                        <div className="flex items-center">{getRankIcon(idx + 1)}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-sm font-bold text-gray-600">
                            {user.displayName?.charAt(0)?.toUpperCase() || '?'}
                          </div>
                          <div>
                            <p className="font-medium text-sm">
                              {user.displayName}
                              {isMe && <span className="text-primary-600 ml-1">(You)</span>}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-sm">{formatHours(user.totalHours || 0)}</td>
                      <td className="px-4 py-3 text-right text-sm font-medium">{user.totalPoints || 0}</td>
                      <td className={`px-4 py-3 text-right text-sm hidden sm:table-cell ${level.color}`}>{level.name}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
