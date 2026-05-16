import { useState, useEffect, useRef } from 'react'
import { Search } from 'lucide-react'

export default function SearchBar({ value, onChange, placeholder = 'Search...' }) {
  const [internal, setInternal] = useState(value || '')
  const timerRef = useRef(null)

  // Keep internal state in sync if parent resets value
  useEffect(() => {
    setInternal(value || '')
  }, [value])

  function handleChange(e) {
    const v = e.target.value
    setInternal(v)
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      onChange(v)
    }, 200)
  }

  // Cleanup on unmount
  useEffect(() => () => clearTimeout(timerRef.current), [])

  return (
    <div className="relative">
      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
      <input
        type="text"
        className="input pl-10"
        placeholder={placeholder}
        value={internal}
        onChange={handleChange}
      />
    </div>
  )
}
