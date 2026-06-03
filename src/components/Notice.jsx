import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react'

const styles = {
  info: { Icon: Info, className: 'border-blue-200 bg-blue-50 text-blue-800' },
  success: { Icon: CheckCircle2, className: 'border-green-200 bg-green-50 text-green-800' },
  warning: { Icon: AlertTriangle, className: 'border-amber-200 bg-amber-50 text-amber-800' },
  error: { Icon: XCircle, className: 'border-red-200 bg-red-50 text-red-800' },
}

export default function Notice({ type = 'info', title, children }) {
  const { Icon, className } = styles[type] || styles.info
  return (
    <div className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${className}`} role={type === 'error' ? 'alert' : 'status'}>
      <Icon size={18} className="mt-0.5 shrink-0" />
      <div className="min-w-0">
        {title && <p className="font-semibold">{title}</p>}
        <div>{children}</div>
      </div>
    </div>
  )
}
