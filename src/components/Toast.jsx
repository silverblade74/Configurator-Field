import { CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { useToastState } from '../contexts/ToastContext'

const style = {
  success: 'border-green-200 bg-green-50 text-green-800',
  info: 'border-blue-200 bg-blue-50 text-blue-800',
  error: 'border-red-200 bg-red-50 text-red-800',
}

const icon = {
  success: CheckCircle2,
  info: Info,
  error: XCircle,
}

export default function ToastContainer() {
  const { toasts, api } = useToastState()
  if (toasts.length === 0) return null
  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 max-w-[calc(100vw-2rem)] space-y-2">
      {toasts.map((toast) => {
        const Icon = icon[toast.type] || Info
        return (
          <div key={toast.id} className={`flex items-start gap-2 rounded-lg border p-3 text-sm shadow-sm ${style[toast.type]}`}>
            <Icon size={16} className="mt-0.5 shrink-0" />
            <p className="flex-1">{toast.message}</p>
            <button aria-label="Dismiss" onClick={() => api.dismiss(toast.id)}><X size={14} /></button>
          </div>
        )
      })}
    </div>
  )
}
