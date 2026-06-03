import { createContext, useCallback, useContext, useMemo, useState } from 'react'

const ToastContext = createContext(null)
let nextToastId = 1

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const dismiss = useCallback((id) => {
    setToasts((items) => items.filter((item) => item.id !== id))
  }, [])

  const push = useCallback((type, message) => {
    const id = nextToastId++
    setToasts((items) => [...items.slice(-2), { id, type, message }])
    if (type !== 'error') window.setTimeout(() => dismiss(id), 3500)
  }, [dismiss])

  const api = useMemo(() => ({
    success: (message) => push('success', message),
    info: (message) => push('info', message),
    error: (message) => push('error', message),
    dismiss,
  }), [dismiss, push])

  return <ToastContext.Provider value={{ toasts, api }}>{children}</ToastContext.Provider>
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used inside ToastProvider')
  return context.api
}

export function useToastState() {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToastState must be used inside ToastProvider')
  return context
}
