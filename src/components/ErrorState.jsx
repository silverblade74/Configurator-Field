import { AlertCircle, RefreshCw } from 'lucide-react'

export default function ErrorState({ message, onRetry }) {
  return (
    <div className="text-center py-12">
      <div className="flex justify-center mb-4">
        <div className="p-4 bg-red-50 rounded-full">
          <AlertCircle size={32} className="text-red-400" />
        </div>
      </div>
      <h3 className="text-lg font-medium text-gray-900">Something went wrong</h3>
      <p className="text-gray-500 mt-1">{message || 'Failed to load data. Please try again.'}</p>
      {onRetry && (
        <button onClick={onRetry} className="btn-primary mt-4 inline-flex items-center space-x-2">
          <RefreshCw size={16} />
          <span>Try Again</span>
        </button>
      )}
    </div>
  )
}
