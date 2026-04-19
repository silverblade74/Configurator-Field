// src/components/Toast.jsx
import { CheckCircle2, Info, XCircle, X } from 'lucide-react'
import { useToastState } from '../contexts/ToastContext'

const styles = {
  success: 'bg-green-50 border-green-200 text-green-800',
  info:    'bg-blue-50 border-blue-200 text-blue-800',
  error:   'bg-red-50 border-red-200 text-red-800',
}

const icons = {
  success: CheckCircle2,
  info:    Info,
  error:   XCircle,
}

export default function ToastContainer() {
  const { toasts, api } = useToastState()
  if (toasts.length === 0) return null
  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2 w-80 max-w-[calc(100vw-2rem)]">
      {toasts.map((t) => {
        const Icon = icons[t.type]
        return (
          <div key={t.id} role="status" className={`flex items-start gap-2 border rounded-lg px-3 py-2 shadow-sm text-sm ${styles[t.type]}`}>
            <Icon size={16} className="mt-0.5 shrink-0" />
            <span className="flex-1 break-words">{t.message}</span>
            <button onClick={() => api.dismiss(t.id)} className="opacity-60 hover:opacity-100 shrink-0" aria-label="Dismiss"><X size={14} /></button>
          </div>
        )
      })}
    </div>
  )
}
