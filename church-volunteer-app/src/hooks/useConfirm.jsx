import { useState, useCallback } from 'react'
import ConfirmModal from '../components/ConfirmModal'

export function useConfirm() {
  const [state, setState] = useState({ open: false, resolve: null, options: {} })

  const confirm = useCallback((options = {}) => {
    return new Promise((resolve) => {
      setState({ open: true, resolve, options })
    })
  }, [])

  const handleConfirm = () => {
    state.resolve?.(true)
    setState({ open: false, resolve: null, options: {} })
  }

  const handleCancel = () => {
    state.resolve?.(false)
    setState({ open: false, resolve: null, options: {} })
  }

  const ConfirmDialog = (
    <ConfirmModal
      open={state.open}
      title={state.options.title}
      message={state.options.message}
      confirmLabel={state.options.confirmLabel}
      danger={state.options.danger}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  )

  return { confirm, ConfirmDialog }
}
