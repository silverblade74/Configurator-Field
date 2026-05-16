export default function BarChart({ title, data, color = 'bg-primary-500', unit = '' }) {
  if (!data || data.length === 0) return null
  const max = Math.max(...data.map((d) => d.value), 1)

  return (
    <div>
      {title && <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">{title}</h3>}
      <div className="space-y-2">
        {data.map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-xs text-gray-500 w-20 truncate text-right">{item.label}</span>
            <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-5 overflow-hidden">
              <div className={`h-5 rounded-full ${color} transition-all`} style={{ width: `${(item.value / max) * 100}%` }} />
            </div>
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400 w-12">{Math.round(item.value * 10) / 10}{unit}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
