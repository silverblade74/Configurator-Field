import { useState } from 'react'
import { Copy, Check, Share2, Link as LinkIcon } from 'lucide-react'

export default function ClaimQRCode({ token }) {
  const [copied, setCopied] = useState(false)
  const claimUrl = `${window.location.origin}/claim/${token}`

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(claimUrl)
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    } catch {
      const input = document.createElement('input')
      input.value = claimUrl; document.body.appendChild(input)
      input.select(); document.execCommand('copy'); document.body.removeChild(input)
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    }
  }

  async function handleShare() {
    if (navigator.share) {
      try { await navigator.share({ title: 'Claim Your Volunteer Profile', text: 'A volunteer profile was created for you. Click the link to claim it!', url: claimUrl }) }
      catch { handleCopy() }
    } else { handleCopy() }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm text-gray-600 mb-1"><LinkIcon className="w-4 h-4" /><span className="font-medium">Claim Link</span></div>
      <div className="flex items-center gap-2">
        <input type="text" readOnly value={claimUrl} className="input flex-1 text-sm bg-gray-50 font-mono" onClick={(e) => e.target.select()} />
        <button onClick={handleCopy} className="flex items-center gap-1 px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700 whitespace-nowrap">
          {copied ? (<><Check className="w-4 h-4 text-green-600" /><span className="text-green-600">Copied</span></>) : (<><Copy className="w-4 h-4" />Copy</>)}
        </button>
      </div>
      <button onClick={handleShare} className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700 font-medium"><Share2 className="w-4 h-4" />Share Link</button>
      <div className="mt-4 flex flex-col items-center">
        <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(claimUrl)}`} alt="QR Code" className="w-48 h-48 border rounded-lg" />
        <p className="text-xs text-gray-400 mt-2">Scan to claim profile</p>
      </div>
    </div>
  )
}
