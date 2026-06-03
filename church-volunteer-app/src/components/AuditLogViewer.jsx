import { useState, useEffect } from 'react'
import { getAuditLogs } from '../services/auditLog'
import { ScrollText } from 'lucide-react'

export default function AuditLogViewer() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const data = await getAuditLogs(100)
        setLogs(data)
      } catch (err) {
        console.error('Error loading audit logs:', err)
      }
      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (logs.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400 dark:text-gray-500">
        <ScrollText size={32} className="mx-auto mb-2 opacity-50" />
        <p>No audit log entries yet.</p>
      </div>
    )
  }

  return (
    <div className="card p-0 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 dark:bg-gray-700 border-b dark:border-gray-600">
          <tr>
            <th className="text-left px-4 py-3">Action</th>
            <th className="text-left px-4 py-3 hidden sm:table-cell">Target</th>
            <th className="text-left px-4 py-3 hidden md:table-cell">Performed By</th>
            <th className="text-left px-4 py-3">When</th>
          </tr>
        </thead>
        <tbody className="divide-y dark:divide-gray-700">
          {logs.map((log) => {
            const ts = log.timestamp?.toDate?.()
            return (
              <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="px-4 py-3">
                  <span className="font-medium">{log.action}</span>
                  {log.details && (
                    <p className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">{log.details}</p>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-500 dark:text-gray-400 hidden sm:table-cell">
                  {log.targetCollection && (
                    <span className="badge bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300 mr-1">
                      {log.targetCollection}
                    </span>
                  )}
                  {log.targetId && (
                    <span className="text-xs font-mono text-gray-400">{log.targetId.slice(0, 8)}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-500 dark:text-gray-400 hidden md:table-cell">
                  {log.performedBy || '-'}
                </td>
                <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs whitespace-nowrap">
                  {ts
                    ? ts.toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })
                    : '-'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
