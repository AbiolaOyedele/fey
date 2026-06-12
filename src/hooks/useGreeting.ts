'use client'

import { useState, useEffect } from 'react'

/**
 * Dashboard hero greeting variations. `{name}` is the workspace name.
 * Add or reorder freely — one is chosen at random per session.
 */
const GREETINGS: ((name: string) => string)[] = [
  (n) => `Welcome, ${n}`,
  (n) => `Hi, ${n}`,
  (n) => `Hey, ${n}`,
  (n) => `Welcome back, ${n}`,
  (n) => `Good to see you, ${n}`,
]

const STORAGE_KEY = 'fey:dashboard_greeting_idx'

/**
 * Returns a greeting for the dashboard hero (e.g. "Welcome, Acme Studio").
 *
 * The variation is chosen once and held for the browser session, so it stays
 * put as the user navigates and reloads — then re-shuffles on the next login /
 * fresh session. The first render uses variation 0 (deterministic, so there is
 * no hydration mismatch); the session's pick is applied right after mount.
 */
export function useGreeting(name: string): string {
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    let chosen: number
    const stored = sessionStorage.getItem(STORAGE_KEY)
    if (stored !== null && !Number.isNaN(Number(stored))) {
      chosen = Number(stored) % GREETINGS.length
    } else {
      chosen = Math.floor(Math.random() * GREETINGS.length)
      try { sessionStorage.setItem(STORAGE_KEY, String(chosen)) } catch { /* storage unavailable */ }
    }
    setIdx(chosen)
  }, [])

  const greet = GREETINGS[idx % GREETINGS.length] ?? GREETINGS[0]
  return greet ? greet(name) : name
}
