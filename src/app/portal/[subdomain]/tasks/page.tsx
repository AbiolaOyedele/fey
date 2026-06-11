'use client'

import { use } from 'react'
import { CheckSquare2 } from 'lucide-react'

export default function PortalTasksPage({ params }: { params: Promise<{ subdomain: string }> }) {
  void use(params)
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Tasks</h1>
      </div>
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <CheckSquare2 size={32} className="text-gray-200 mb-3" />
        <p className="text-[15px] font-medium text-gray-500">No tasks yet</p>
        <p className="text-[13px] text-gray-400 mt-1">Tasks assigned to you will appear here.</p>
      </div>
    </div>
  )
}
