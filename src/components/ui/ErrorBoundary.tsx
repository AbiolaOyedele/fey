'use client'

import { Component, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'

interface ErrorBoundaryProps {
  children: ReactNode
  /** Shown in place of the children when they throw. */
  fallbackTitle?: string
  /** Optional label to identify which section failed in logs. */
  label?: string
}

interface ErrorBoundaryState {
  error: Error | null
}

/**
 * Catches render-time errors in a subtree so one broken section can't take down
 * the whole page. Logs the error (with the failing section label) for diagnosis
 * and renders a quiet, retryable fallback card in its place.
 */
export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    // eslint-disable-next-line no-console
    console.error(`[ErrorBoundary${this.props.label ? `:${this.props.label}` : ''}]`, error, info?.componentStack)
  }

  private reset = () => this.setState({ error: null })

  render() {
    if (this.state.error) {
      return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col items-center justify-center text-center gap-2">
          <AlertTriangle size={22} className="text-gray-300" />
          <p className="text-sm font-medium text-gray-700">{this.props.fallbackTitle ?? 'This section couldn’t load'}</p>
          <p className="text-xs text-gray-400 max-w-xs">Something went wrong loading this part of your dashboard. The rest of the page is unaffected.</p>
          <button
            onClick={this.reset}
            className="mt-1 text-xs font-medium px-3 py-1.5 rounded-full text-white"
            style={{ backgroundColor: 'var(--accent, #ED64A6)' }}
          >
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
