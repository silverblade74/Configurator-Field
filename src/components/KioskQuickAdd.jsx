import { useState, useRef, useEffect } from 'react'
import { DEPARTMENTS } from '../utils/departments'
import { UserPlus } from 'lucide-react'

export default function KioskQuickAdd({ defaultName, onAdd, batchMode, batchCount }) {
  const [name, setName] = useState(defaultName || '')
  const [phone, setPhone] = useState('')
  const [department, setDepartment] = useState('')
  const [adding, setAdding] = useState(false)
  const nameRef = useRef(null)

  useEffect(() => { setName(defaultName || '') }, [defaultName])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) return
    setAdding(true)
    try {
      await onAdd({ displayName: name.trim(), phone: phone.trim(), email: '', department })
      setName(''); setPhone('')
      if (!batchMode) setDepartment('')
      nameRef.current?.focus()
    } catch (err) { console.error('Quick add failed:', err) }
    setAdding(false)
  }

  return (
    <form onSubmit={handleSubmit} className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="font-semibold text-blue-800 flex items-center gap-2"><UserPlus size={18} />New Volunteer</p>
        {batchMode && batchCount > 0 && (<span className="badge bg-blue-200 text-blue-800">{batchCount} added</span>)}
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <input ref={nameRef} type="text" className="input flex-1 !min-h-[48px] text-base" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name *" required autoFocus />
        <input type="tel" className="input w-full sm:w-36 !min-h-[48px]" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" />
        <select className="input w-full sm:w-40 !min-h-[48px]" value={department} onChange={(e) => setDepartment(e.target.value)}>
          <option value="">Department</option>
          {DEPARTMENTS.map((d) => (<option key={d.id} value={d.id}>{d.icon} {d.name}</option>))}
        </select>
        <button type="submit" disabled={adding || !name.trim()} className="btn-kiosk whitespace-nowrap !min-h-[48px]">{adding ? 'Adding...' : '+ Add & Check In'}</button>
      </div>
    </form>
  )
}
