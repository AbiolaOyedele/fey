/** Small formatting helpers shared across the Image Pipeline UI. */

/** Credits: up to 2 dp, trailing zeros trimmed (2 → "2", 0.25 → "0.25"). */
export function fmtCredits(n: number): string {
  return (Math.round(n * 100) / 100).toString()
}

/** Credits with a correctly-pluralised unit, e.g. "1 credit", "0.25 credits". */
export function creditsLabel(n: number): string {
  return `${fmtCredits(n)} ${n === 1 ? 'credit' : 'credits'}`
}

/** USD with 2 dp and a leading symbol. */
export function fmtUsd(n: number): string {
  return `$${(Math.round(n * 100) / 100).toFixed(2)}`
}

/** Relative "time left" until an ISO deadline (e.g. "6d left", "3h left"). */
export function timeLeft(iso: string): { label: string; urgent: boolean } {
  const ms = new Date(iso).getTime() - Date.now()
  if (ms <= 0) return { label: 'Expired', urgent: true }
  const days = Math.floor(ms / 86_400_000)
  if (days >= 1) return { label: `${days}d left`, urgent: days <= 1 }
  const hours = Math.floor(ms / 3_600_000)
  if (hours >= 1) return { label: `${hours}h left`, urgent: true }
  const mins = Math.max(1, Math.floor(ms / 60_000))
  return { label: `${mins}m left`, urgent: true }
}

/** Short human date, e.g. "30 Jul, 14:20". */
export function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}
