'use client'

interface InsightCardProps {
  title: string
  icon: React.ReactNode
  /** Short line under the title explaining what the panel measures. */
  hint?: string
  /** Pushed to the right of the header — counts, legends, small controls. */
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}

/**
 * The shared shell every insights panel sits in, so the whole section keeps one
 * header rhythm. Matches the house card: white, hairline border, soft shadow.
 */
export default function InsightCard({ title, icon, hint, action, children, className = '' }: InsightCardProps) {
  return (
    <section className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-6 ${className}`}>
      <header className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {icon}
            <h2 className="text-sm font-semibold text-gray-800 truncate">{title}</h2>
          </div>
          {hint && <p className="text-2xs text-gray-400 mt-0.5">{hint}</p>}
        </div>
        {action && <div className="flex-shrink-0">{action}</div>}
      </header>
      {children}
    </section>
  )
}
