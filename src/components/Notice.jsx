import { CheckCircle2, Info, AlertTriangle, XCircle } from 'lucide-react'

const styles = {
  info: { wrap: 'bg-blue-50 text-blue-800 border-blue-200', Icon: Info },
  success: { wrap: 'bg-green-50 text-green-800 border-green-200', Icon: CheckCircle2 },
  warning: { wrap: 'bg-amber-50 text-amber-800 border-amber-200', Icon: AlertTriangle },
  error: { wrap: 'bg-red-50 text-red-800 border-red-200', Icon: XCircle },
}

export default function Notice({ type = 'info', title, children }) {
  const { wrap, Icon } = styles[type] || styles.info
  const role = type === 'error' ? 'alert' : 'status'
  const ariaLive = type === 'error' ? undefined : 'polite'
  return (
    <div role={role} aria-live={ariaLive} className={`flex gap-2 items-start rounded-lg border p-3 text-sm ${wrap}`}>
      <Icon size={18} className="shrink-0 mt-0.5" />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        <div>{children}</div>
      </div>
    </div>
  )
}
