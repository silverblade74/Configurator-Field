import { useState, useEffect, useRef } from 'react'
import { Search as SearchIcon } from 'lucide-react'

export default function SearchBar({ value, onChange, placeholder = 'Search...' }) {
  const [local, setLocal] = useState(value || '')
  const timerRef = useRef(null)

  useEffect(() => { setLocal(value || '') }, [value])

  function handleChange(e) {
    const v = e.target.value
    setLocal(v)
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => onChange(v), 200)
  }

  return (
    <div className="relative">
      <SearchIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
      <input type="text" className="input pl-9" value={local} onChange={handleChange} placeholder={placeholder} />
    </div>
  )
}
