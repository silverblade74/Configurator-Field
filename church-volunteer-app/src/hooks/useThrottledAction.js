import { useRef, useCallback } from 'react'

export function useThrottledAction(action, delayMs = 1000) {
  const lastCall = useRef(0)

  return useCallback(
    (...args) => {
      const now = Date.now()
      if (now - lastCall.current < delayMs) {
        return // ignore call within throttle window
      }
      lastCall.current = now
      return action(...args)
    },
    [action, delayMs],
  )
}
