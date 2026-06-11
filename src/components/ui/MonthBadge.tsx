'use client'

interface MonthBadgeProps {
  month: string
  isActive: boolean
  onClick: () => void
}

export default function MonthBadge({ month, isActive, onClick }: MonthBadgeProps) {
  const date  = new Date(month + '-01')
  const label = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })

  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 ${
        isActive
          ? 'bg-primary text-white'
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      }`}
    >
      {label}
    </button>
  )
}
