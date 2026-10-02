/**
 * src/components/layout/PageLayout.jsx
 * Wraps each page with safe-area padding and bottom nav spacing.
 */

export function PageLayout({ children, className = '' }) {
  return (
    <div className={`page-wrapper ${className}`}>
      {/* Content area - leaves space for bottom nav */}
      <div className="pb-24 min-h-dvh">
        {children}
      </div>
    </div>
  )
}

/**
 * Top header bar
 */
export function PageHeader({ title, subtitle, right, left }) {
  return (
    <header className="sticky top-0 bg-white z-20 border-b border-gray-100 px-4 pt-safe">
      <div className="flex items-center justify-between h-14">
        {left ? (
          <div className="w-10 flex items-center justify-start">{left}</div>
        ) : (
          <div className="w-10" />
        )}
        <div className="text-center">
          <h1 className="text-base font-bold text-gray-900 leading-tight">{title}</h1>
          {subtitle && (
            <p className="text-xs text-gray-400 leading-tight">{subtitle}</p>
          )}
        </div>
        {right ? (
          <div className="flex items-center justify-end gap-1">{right}</div>
        ) : (
          <div className="w-10" />
        )}
      </div>
    </header>
  )
}
