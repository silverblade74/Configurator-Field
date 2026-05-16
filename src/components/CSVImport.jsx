import { useState, useRef } from 'react'
import { Upload, FileText, AlertCircle, Check } from 'lucide-react'
import { createManagedVolunteer } from '../services/firestore'
import { DEPARTMENTS } from '../utils/departments'
import { useToast } from './ToastProvider'

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  if (lines.length === 0) return { headers: [], rows: [] }
  const parseLine = (line) => {
    const fields = []; let current = ''; let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') { if (inQuotes && line[i + 1] === '"') { current += '"'; i++ } else { inQuotes = !inQuotes } }
      else if (ch === ',' && !inQuotes) { fields.push(current.trim()); current = '' }
      else { current += ch }
    }
    fields.push(current.trim()); return fields
  }
  const headers = parseLine(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, ''))
  const rows = lines.slice(1).map((line) => { const values = parseLine(line); const row = {}; headers.forEach((h, i) => { row[h] = values[i] || '' }); return row })
  return { headers, rows }
}

export default function CSVImport({ onComplete }) {
  const toast = useToast()
  const fileRef = useRef()
  const [parsed, setParsed] = useState(null)
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [errors, setErrors] = useState([])
  const [done, setDone] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  function handleFile(file) {
    if (!file || !file.name.endsWith('.csv')) { toast.error('Please upload a .csv file'); return }
    const reader = new FileReader()
    reader.onload = (e) => {
      const { headers, rows } = parseCSV(e.target.result)
      if (rows.length === 0) { toast.error('No data rows found'); return }
      if (rows.length > 100) { toast.error('Maximum 100 rows per import'); return }
      if (!headers.includes('name') && !headers.includes('displayname') && !headers.includes('fullname')) {
        toast.error('CSV must have a "name" column'); return
      }
      setParsed({ headers, rows })
    }
    reader.readAsText(file)
  }

  function getNameField(row) { return row.name || row.displayname || row.fullname || '' }
  function getDeptId(row) {
    const val = (row.department || row.dept || '').toLowerCase()
    if (!val) return ''
    const match = DEPARTMENTS.find((d) => d.name.toLowerCase() === val || d.id === val)
    return match?.id || ''
  }

  async function handleImport() {
    setImporting(true); setProgress({ done: 0, total: parsed.rows.length }); setErrors([])
    const errs = []
    for (let i = 0; i < parsed.rows.length; i++) {
      const row = parsed.rows[i]
      const name = getNameField(row)
      if (!name) { errs.push({ row: i + 2, message: 'Name is empty' }); setProgress((p) => ({ ...p, done: p.done + 1 })); continue }
      try {
        await createManagedVolunteer({ displayName: name, email: row.email || '', phone: row.phone || '' })
      } catch (err) { errs.push({ row: i + 2, message: err.message }) }
      setProgress((p) => ({ ...p, done: p.done + 1 }))
    }
    setErrors(errs); setImporting(false); setDone(true)
    const success = parsed.rows.length - errs.length
    toast.success(`Imported ${success} volunteer${success !== 1 ? 's' : ''}`)
    if (onComplete) onComplete()
  }

  if (done) return (
    <div className="card text-center py-6">
      <Check size={32} className="mx-auto text-green-500 mb-2" />
      <p className="font-semibold">Import Complete</p>
      <p className="text-sm text-gray-500">{parsed.rows.length - errors.length} imported{errors.length > 0 && `, ${errors.length} failed`}</p>
      {errors.length > 0 && (<div className="mt-3 text-left border border-red-200 rounded-lg p-3 bg-red-50 max-h-32 overflow-y-auto">{errors.map((e, i) => (<p key={i} className="text-xs text-red-600">Row {e.row}: {e.message}</p>))}</div>)}
      <button onClick={() => { setParsed(null); setDone(false); setErrors([]) }} className="btn-secondary mt-4">Import More</button>
    </div>
  )

  if (parsed) return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2"><FileText size={18} />Preview ({parsed.rows.length} rows)</h3>
        <button onClick={() => setParsed(null)} className="text-sm text-gray-400 hover:text-gray-600">Cancel</button>
      </div>
      <div className="border rounded-lg overflow-x-auto max-h-60 overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 sticky top-0"><tr>{parsed.headers.map((h) => (<th key={h} className="text-left px-2 py-1 font-medium text-gray-500">{h}</th>))}</tr></thead>
          <tbody className="divide-y">{parsed.rows.slice(0, 20).map((row, i) => (<tr key={i}>{parsed.headers.map((h) => (<td key={h} className="px-2 py-1">{row[h] || '-'}</td>))}</tr>))}</tbody>
        </table>
        {parsed.rows.length > 20 && (<p className="text-xs text-gray-400 text-center py-2">...and {parsed.rows.length - 20} more rows</p>)}
      </div>
      {importing ? (
        <div className="space-y-2"><div className="flex items-center gap-2"><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div><span className="text-sm">Importing... {progress.done}/{progress.total}</span></div><div className="w-full bg-gray-200 rounded-full h-2"><div className="bg-primary-600 h-2 rounded-full transition-all" style={{ width: `${(progress.done / progress.total) * 100}%` }}></div></div></div>
      ) : (
        <button onClick={handleImport} className="btn-primary w-full">Import {parsed.rows.length} Volunteers</button>
      )}
    </div>
  )

  return (
    <div className={`card border-2 border-dashed transition-colors ${dragOver ? 'border-primary-400 bg-primary-50' : 'border-gray-300'}`}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]) }}>
      <div className="text-center py-8">
        <Upload size={32} className="mx-auto text-gray-400 mb-3" />
        <p className="font-medium text-gray-700">Drop a CSV file here</p>
        <p className="text-sm text-gray-400 mt-1">or click to browse</p>
        <p className="text-xs text-gray-400 mt-2">Columns: name (required), email, phone, department</p>
        <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={(e) => handleFile(e.target.files[0])} />
        <button onClick={() => fileRef.current?.click()} className="btn-secondary mt-4">Choose File</button>
      </div>
    </div>
  )
}
