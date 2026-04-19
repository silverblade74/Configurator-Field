// src/contexts/ToastContext.jsx
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'

const ToastContext = createContext(null)

let nextId = 1

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timers = useRef(new Map())

  const dismiss = useCallback((id) => {
    setToasts((ts) => ts.filter((t) => t.id !== id))
    const timer = timers.current.get(id)
    if (timer) { clearTimeout(timer); timers.current.delete(id) }
  }, [])

  const push = useCallback((type, message, { sticky = false } = {}) => {
    const id = nextId++
    setToasts((ts) => [...ts.slice(-2), { id, type, message, sticky }])
    if (!sticky) {
      const timer = setTimeout(() => dismiss(id), 3000)
      timers.current.set(id, timer)
    }
    return id
  }, [dismiss])

  const api = useMemo(() => ({
    success: (msg) => push('success', msg),
    info: (msg) => push('info', msg),
    error: (msg) => push('error', msg, { sticky: true }),
    dismiss,
  }), [push, dismiss])

  return <ToastContext.Provider value={{ toasts, api }}>{children}</ToastContext.Provider>
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx.api
}

export function useToastState() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToastState must be used inside <ToastProvider>')
  return ctx
}
