import { useEffect } from 'react'

export default function ConfirmModal({ open, title, message, confirmLabel, onConfirm, onCancel, danger }) {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
        <h3 className="font-semibold text-lg">{title || 'Confirm'}</h3>
        <p className="text-sm text-gray-500 mt-2">{message}</p>
        <div className="flex justify-end space-x-2 mt-6">
          <button onClick={onCancel} className="btn-secondary">Cancel</button>
          <button onClick={onConfirm} className={danger ? 'btn-danger' : 'btn-primary'}>
            {confirmLabel || 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}
