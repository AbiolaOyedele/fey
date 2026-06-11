'use client'

import { CheckCircle2 } from 'lucide-react'

export default function PaySuccessPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl p-8">
        <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 size={32} className="text-emerald-500" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Payment received!</h1>
        <p className="text-sm text-gray-500 leading-relaxed">
          Your payment has been processed successfully. You&apos;ll receive a confirmation email shortly.
        </p>
        <p className="text-xs text-gray-400 mt-4">You can close this tab.</p>
      </div>
    </div>
  )
}
