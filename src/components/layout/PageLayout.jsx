/**
 * src/components/layout/PageLayout.jsx
 * Responsive container for mobile, tablet, and desktop views.
 */

export function PageLayout({ children, className = '' }) {
  return (
    <div className={`w-full max-w-3xl lg:max-w-5xl xl:max-w-6xl mx-auto ${className}`}>
      {/* Content area — bottom pad for mobile nav, smaller on desktop */}
      <div className="pb-24 md:pb-16">
        {children}
      </div>
    </div>
  )
}

/**
 * Page Header bar — responsive across mobile & desktop
 */
export function PageHeader({ title, subtitle, right, left }) {
  return (
    <header className="sticky top-0 md:static bg-white md:bg-transparent z-20 border-b border-gray-100 md:border-none px-4 md:px-0 py-2 md:py-5 pt-safe">
      <div className="flex items-center justify-between h-14 md:h-auto">
        {left ? (
          <div className="flex items-center justify-start">{left}</div>
        ) : (
          <div className="hidden md:block w-24" />
        )}
        <div className="flex-1 text-center md:text-left md:flex-none">
          <h1 className="text-base md:text-2xl font-bold md:font-extrabold text-gray-900 leading-tight">{title}</h1>
          {subtitle && (
            <p className="text-xs md:text-sm text-gray-500 leading-tight mt-0.5">{subtitle}</p>
          )}
        </div>
        {right ? (
          <div className="flex items-center justify-end gap-2">{right}</div>
        ) : (
          <div className="hidden md:block w-24" />
        )}
      </div>
    </header>
  )
}
