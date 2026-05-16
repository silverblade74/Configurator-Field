/**
 * Simple horizontal bar chart using CSS.
 * No external chart library needed.
 *
 * Props:
 *  - title: string
 *  - data: [{ label: string, value: number }]
 *  - color: tailwind color name (default 'primary')
 *  - unit: string suffix for values (default '')
 */
export default function BarChart({ title, data = [], color = 'primary', unit = '' }) {
  const max = Math.max(...data.map((d) => d.value), 1)

  const colorMap = {
    primary: 'bg-primary-500',
    green: 'bg-green-500',
    orange: 'bg-orange-500',
    purple: 'bg-purple-500',
    blue: 'bg-blue-500',
    red: 'bg-red-500',
  }
  const barColor = colorMap[color] || 'bg-primary-500'

  return (
    <div className="card">
      {title && <h3 className="font-semibold text-sm mb-4">{title}</h3>}
      {data.length === 0 ? (
        <p className="text-gray-400 text-sm text-center py-4">No data available</p>
      ) : (
        <div className="space-y-3">
          {data.map((item, i) => (
            <div key={i}>
              <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                <span className="truncate mr-2">{item.label}</span>
                <span className="font-medium whitespace-nowrap">
                  {typeof item.value === 'number' ? item.value.toFixed(1) : item.value}
                  {unit}
                </span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-4 overflow-hidden">
                <div
                  className={`h-full rounded-full ${barColor} transition-all duration-500`}
                  style={{ width: `${Math.max((item.value / max) * 100, 2)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
