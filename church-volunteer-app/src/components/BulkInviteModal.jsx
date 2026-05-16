import { useState } from 'react'
import { useToast } from './ToastProvider'
import { generateClaimForVolunteer } from '../services/firestore'
import { Copy, Check, Mail, X } from 'lucide-react'

export default function BulkInviteModal({ volunteers, onClose }) {
  const toast = useToast()
  const [generating, setGenerating] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [results, setResults] = useState([])
  const [copied, setCopied] = useState(false)

  // Filter to managed volunteers with email but no claimToken
  const eligible = volunteers.filter(
    (v) => v.managed && v.email && !v.claimToken
  )

  async function handleGenerateAll() {
    setGenerating(true)
    setProgress({ done: 0, total: eligible.length })
    const generated = []

    for (const vol of eligible) {
      try {
        const token = await generateClaimForVolunteer(vol.id)
        const url = `${window.location.origin}/claim/${token}`
        generated.push({ name: vol.displayName, email: vol.email, url })
      } catch (err) {
        generated.push({ name: vol.displayName, email: vol.email, url: null, error: err.message })
      }
      setProgress((p) => ({ ...p, done: p.done + 1 }))
    }

    setResults(generated)
    setGenerating(false)
    toast.success(`Generated ${generated.filter((r) => r.url).length} claim links`)
  }

  function getClipboardText() {
    return results
      .filter((r) => r.url)
      .map((r) => `${r.name} (${r.email}) - ${r.url}`)
      .join('\n')
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(getClipboardText())
      setCopied(true)
      toast.success('Copied to clipboard')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Failed to copy')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-semibold text-lg flex items-center gap-2">
            <Mail size={20} />
            Bulk Invite Links
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 flex-1 overflow-y-auto space-y-4">
          {results.length === 0 && (
            <>
              <p className="text-sm text-gray-600">
                Generate claim links for managed volunteers who have an email address.
                You can then copy all links and paste them into your email tool.
              </p>

              {eligible.length === 0 ? (
                <div className="text-center py-6 text-gray-400">
                  <Mail size={32} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No eligible volunteers found.</p>
                  <p className="text-xs mt-1">
                    Volunteers need to be managed (no account) with an email and no existing claim link.
                  </p>
                </div>
              ) : (
                <>
                  <div className="border rounded-lg overflow-hidden">
                    <div className="bg-gray-50 px-3 py-2 text-xs font-medium text-gray-500">
                      {eligible.length} volunteer{eligible.length !== 1 ? 's' : ''} ready for invite
                    </div>
                    <div className="max-h-48 overflow-y-auto divide-y">
                      {eligible.map((v) => (
                        <div key={v.id} className="px-3 py-2 text-sm flex justify-between">
                          <span className="font-medium">{v.displayName}</span>
                          <span className="text-gray-400 text-xs">{v.email}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {generating ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
                        <span className="text-sm text-gray-600">
                          Generating... {progress.done}/{progress.total}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-primary-600 h-2 rounded-full transition-all"
                          style={{ width: `${(progress.done / progress.total) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  ) : (
                    <button onClick={handleGenerateAll} className="btn-primary w-full">
                      Generate All Links ({eligible.length})
                    </button>
                  )}
                </>
              )}
            </>
          )}

          {results.length > 0 && (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-green-700 flex items-center gap-1">
                  <Check size={16} />
                  {results.filter((r) => r.url).length} links generated
                </p>
                <button
                  onClick={handleCopy}
                  className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1"
                >
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                  {copied ? 'Copied!' : 'Copy All'}
                </button>
              </div>

              <div className="border rounded-lg bg-gray-50 p-3 max-h-60 overflow-y-auto">
                <pre className="text-xs whitespace-pre-wrap break-all font-mono text-gray-700">
                  {getClipboardText()}
                </pre>
              </div>

              {results.some((r) => r.error) && (
                <div className="border border-red-200 rounded-lg p-3 bg-red-50">
                  <p className="text-xs font-medium text-red-700 mb-1">Failed:</p>
                  {results
                    .filter((r) => r.error)
                    .map((r, i) => (
                      <p key={i} className="text-xs text-red-600">
                        {r.name}: {r.error}
                      </p>
                    ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t p-4 flex justify-end">
          <button onClick={onClose} className="btn-secondary">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
