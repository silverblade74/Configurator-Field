import { useState, useRef } from 'react'
import { Upload, FileText, AlertCircle, Check } from 'lucide-react'
import { createManagedVolunteer } from '../services/firestore'
import { DEPARTMENTS } from '../utils/departments'
import { useToast } from './ToastProvider'

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  if (lines.length === 0) return { headers: [], rows: [] }

  const parseLine = (line) => {
    const fields = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = !inQuotes
        }
      } else if (ch === ',' && !inQuotes) {
        fields.push(current.trim())
        current = ''
      } else {
        current += ch
      }
    }
    fields.push(current.trim())
    return fields
  }

  const headers = parseLine(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, ''))
  const rows = lines.slice(1).map((line) => {
    const values = parseLine(line)
    const row = {}
    headers.forEach((h, i) => {
      row[h] = values[i] || ''
    })
    return row
  })

  return { headers, rows }
}

export default function CSVImport({ onComplete }) {
  const toast = useToast()
  const fileRef = useRef()
  const [dragOver, setDragOver] = useState(false)
  const [parsed, setParsed] = useState(null)
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [errors, setErrors] = useState([])
  const [complete, setComplete] = useState(false)

  function handleFile(file) {
    if (!file) return
    if (!file.name.endsWith('.csv')) {
      toast.error('Please select a .csv file')
      return
    }
    const reader = new FileReader()
    reader.onload = (e) => {
      const { headers, rows } = parseCSV(e.target.result)
      if (!headers.includes('name')) {
        toast.error('CSV must have a "name" column')
        return
      }
      if (rows.length === 0) {
        toast.error('CSV has no data rows')
        return
      }
      if (rows.length > 100) {
        toast.error('Maximum 100 rows per import')
        return
      }
      setParsed({ headers, rows })
      setErrors([])
      setComplete(false)
    }
    reader.readAsText(file)
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    handleFile(file)
  }

  function handleDragOver(e) {
    e.preventDefault()
    setDragOver(true)
  }

  function handleDragLeave() {
    setDragOver(false)
  }

  function handleFileInput(e) {
    handleFile(e.target.files[0])
  }

  async function handleImport() {
    if (!parsed) return
    setImporting(true)
    setErrors([])
    setProgress({ done: 0, total: parsed.rows.length })

    const importErrors = []

    for (let i = 0; i < parsed.rows.length; i++) {
      const row = parsed.rows[i]
      const name = row.name || ''
      if (!name.trim()) {
        importErrors.push({ row: i + 2, message: 'Name is required' })
        setProgress((p) => ({ ...p, done: p.done + 1 }))
        continue
      }

      // Validate department if provided
      const dept = row.department || ''
      if (dept && !DEPARTMENTS.find((d) => d.id === dept.toLowerCase() || d.name.toLowerCase() === dept.toLowerCase())) {
        // Skip invalid department, import without it
      }

      try {
        await createManagedVolunteer({
          displayName: name.trim(),
          email: (row.email || '').trim(),
          phone: (row.phone || '').trim(),
        })
      } catch (err) {
        importErrors.push({ row: i + 2, message: err.message || 'Failed to create' })
      }
      setProgress((p) => ({ ...p, done: p.done + 1 }))
    }

    setErrors(importErrors)
    setImporting(false)
    setComplete(true)

    const successCount = parsed.rows.length - importErrors.length
    if (successCount > 0) {
      toast.success(`Imported ${successCount} volunteer${successCount !== 1 ? 's' : ''}`)
    }
    if (importErrors.length > 0) {
      toast.error(`${importErrors.length} row${importErrors.length !== 1 ? 's' : ''} failed`)
    }
    if (onComplete) onComplete()
  }

  function reset() {
    setParsed(null)
    setErrors([])
    setComplete(false)
    setProgress({ done: 0, total: 0 })
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <FileText size={18} />
          CSV Import
        </h3>
        {parsed && !importing && (
          <button onClick={reset} className="btn-secondary text-xs py-1 px-3">
            Clear
          </button>
        )}
      </div>

      <p className="text-xs text-gray-500">
        Upload a CSV file with columns: <strong>name</strong> (required), email, phone, department.
        Maximum 100 rows per import.
      </p>

      {/* Drop zone */}
      {!parsed && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
            dragOver ? 'border-primary-400 bg-primary-50' : 'border-gray-300 hover:border-gray-400'
          }`}
          onClick={() => fileRef.current?.click()}
        >
          <Upload size={32} className="mx-auto text-gray-400 mb-2" />
          <p className="text-sm text-gray-600">
            Drag & drop a CSV file here, or click to browse
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleFileInput}
          />
        </div>
      )}

      {/* Preview table */}
      {parsed && !complete && (
        <div className="space-y-3">
          <p className="text-sm font-medium">
            Preview ({parsed.rows.length} row{parsed.rows.length !== 1 ? 's' : ''})
          </p>
          <div className="overflow-x-auto max-h-60 border rounded-lg">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2 text-gray-500">#</th>
                  <th className="text-left px-3 py-2">Name</th>
                  {parsed.headers.includes('email') && <th className="text-left px-3 py-2">Email</th>}
                  {parsed.headers.includes('phone') && <th className="text-left px-3 py-2">Phone</th>}
                  {parsed.headers.includes('department') && <th className="text-left px-3 py-2">Department</th>}
                </tr>
              </thead>
              <tbody className="divide-y">
                {parsed.rows.map((row, i) => (
                  <tr key={i} className={!row.name?.trim() ? 'bg-red-50' : ''}>
                    <td className="px-3 py-1.5 text-gray-400">{i + 1}</td>
                    <td className="px-3 py-1.5">{row.name || <span className="text-red-500 italic">missing</span>}</td>
                    {parsed.headers.includes('email') && <td className="px-3 py-1.5 text-gray-500">{row.email}</td>}
                    {parsed.headers.includes('phone') && <td className="px-3 py-1.5 text-gray-500">{row.phone}</td>}
                    {parsed.headers.includes('department') && <td className="px-3 py-1.5 text-gray-500">{row.department}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Import button */}
          {!importing && (
            <div className="flex space-x-2">
              <button onClick={handleImport} className="btn-primary flex items-center gap-1">
                <Upload size={14} />
                Import {parsed.rows.length} Volunteer{parsed.rows.length !== 1 ? 's' : ''}
              </button>
              <button onClick={reset} className="btn-secondary">Cancel</button>
            </div>
          )}

          {/* Progress */}
          {importing && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
                <span className="text-sm text-gray-600">
                  Importing... {progress.done}/{progress.total}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-primary-600 h-2 rounded-full transition-all"
                  style={{ width: `${(progress.done / progress.total) * 100}%` }}
                ></div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Complete state */}
      {complete && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-green-600">
            <Check size={18} />
            <span className="text-sm font-medium">
              Import complete — {parsed.rows.length - errors.length} of {parsed.rows.length} succeeded
            </span>
          </div>

          {errors.length > 0 && (
            <div className="border border-red-200 rounded-lg p-3 bg-red-50">
              <div className="flex items-center gap-2 text-red-700 mb-2">
                <AlertCircle size={14} />
                <span className="text-xs font-medium">Errors ({errors.length})</span>
              </div>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {errors.map((err, i) => (
                  <p key={i} className="text-xs text-red-600">
                    Row {err.row}: {err.message}
                  </p>
                ))}
              </div>
            </div>
          )}

          <button onClick={reset} className="btn-secondary text-sm">
            Import Another File
          </button>
        </div>
      )}
    </div>
  )
}
