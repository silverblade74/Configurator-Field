// src/hooks/useAsyncAction.js
import { useCallback, useState } from 'react'
import { useToast } from '../contexts/ToastContext'

// run(actionFn, { successMessage, errorMessage }) -> Promise<result>
// Provides: saving boolean, last error.
// Handles: spinner state, success toast, error toast with server error message.
export function useAsyncAction() {
  const toast = useToast()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const run = useCallback(async (fn, { successMessage = 'Saved', errorMessage = 'Could not save' } = {}) => {
    setSaving(true); setError(null)
    try {
      const result = await fn()
      if (successMessage) toast.success(successMessage)
      return result
    } catch (err) {
      setError(err)
      toast.error(`${errorMessage}: ${err?.message || String(err)}`)
      throw err
    } finally {
      setSaving(false)
    }
  }, [toast])

  return { run, saving, error }
}
