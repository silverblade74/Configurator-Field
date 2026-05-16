import { useState, useEffect } from 'react'
import { getMinistries } from '../services/firestore'
import EmptyState from '../components/EmptyState'
import SearchBar from '../components/SearchBar'
import { Users, Mail, User } from 'lucide-react'

export default function Ministries() {
  const [ministries, setMinistries] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const data = await getMinistries()
        setMinistries(data)
      } catch (err) {
        console.error('Error loading ministries:', err)
      }
      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  const filteredMinistries = ministries.filter(
    (m) => !searchQuery || m.name.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold">Ministries & Teams</h1>
        <div className="w-full sm:w-64">
          <SearchBar value={searchQuery} onChange={setSearchQuery} placeholder="Search ministries..." />
        </div>
      </div>

      {filteredMinistries.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No ministries yet"
          description="Ministries will appear here once an admin creates them."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredMinistries.map((ministry) => (
            <div key={ministry.id} className="card hover:shadow-md transition-shadow">
              <div className="flex items-start space-x-3">
                <div className="p-3 bg-primary-50 rounded-lg">
                  <Users size={20} className="text-primary-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">{ministry.name}</h3>
                  {ministry.description && (
                    <p className="text-sm text-gray-500 mt-1">{ministry.description}</p>
                  )}
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-100 space-y-2 text-sm text-gray-600">
                {ministry.leaderName && (
                  <div className="flex items-center space-x-2">
                    <User size={14} />
                    <span>Led by {ministry.leaderName}</span>
                  </div>
                )}
                {ministry.contactEmail && (
                  <div className="flex items-center space-x-2">
                    <Mail size={14} />
                    <span>{ministry.contactEmail}</span>
                  </div>
                )}
                <div className="flex items-center space-x-2">
                  <Users size={14} />
                  <span>{ministry.memberCount || 0} members</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
