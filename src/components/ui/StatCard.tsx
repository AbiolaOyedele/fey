'use client'

import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'

interface StatCardProps {
  label: string
  value: string | number
  icon?: LucideIcon
  color?: string
  to?: string
}

export default function StatCard({ label, value, icon: Icon, color = 'text-primary', to }: StatCardProps) {
  const inner = (
    <>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-gray-500 font-medium">{label}</span>
        {Icon && <Icon size={18} className={color} />}
      </div>
      <p className={`text-2xl font-mono font-semibold ${color}`}>{value}</p>
    </>
  )

  const className = 'bg-white rounded-2xl p-6 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 block cursor-pointer'

  if (to) {
    return <Link href={to} className={className}>{inner}</Link>
  }

  return <div className={className}>{inner}</div>
}
