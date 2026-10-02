/**
 * src/components/ui/EmptyState.jsx
 */

export function EmptyState({ icon: Icon, title, hint, action, actionLabel }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
      {Icon && (
        <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
          <Icon size={28} className="text-gray-400" />
        </div>
      )}
      <p className="text-base font-semibold text-gray-700 mb-1">{title}</p>
      {hint && <p className="text-sm text-gray-400 mb-6">{hint}</p>}
      {action && actionLabel && (
        <button onClick={action} className="btn-blue w-auto px-6 py-2 text-sm">
          {actionLabel}
        </button>
      )}
    </div>
  )
}
