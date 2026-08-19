/**
 * Catching an email typo at the moment it's typed.
 *
 * `z.string().email()` accepts "temitopelumi@gmail.con" — it is a perfectly
 * well-formed address, and there is no syntax rule it breaks. The damage shows
 * up later: the account is created against an address nobody reads, so the
 * welcome mail bounces into nothing, and any future reset is sent somewhere the
 * person will never see.
 *
 * Worth being clear about what this does and doesn't do. A consistent typo
 * still logs in fine — the password check doesn't care whether the domain is
 * real — so this is not about making sign-in work. It's about not creating an
 * account against an address that can't be reached. Only address verification
 * proves an inbox exists; this just refuses to let an obvious slip through
 * silently.
 *
 * It suggests rather than blocks. Unusual domains are real, and a checker that
 * rejects them is worse than the typo it was added to prevent.
 */

/**
 * Domains common enough that a near-miss is almost certainly a typo. Listed as
 * exact matches too, so a real address at one of them never gets "corrected".
 */
const KNOWN_DOMAINS = [
  'gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'live.com',
  'msn.com', 'yahoo.com', 'yahoo.co.uk', 'ymail.com', 'icloud.com', 'me.com',
  'mac.com', 'aol.com', 'proton.me', 'protonmail.com', 'zoho.com', 'gmx.com',
  'mail.com', 'yandex.com', 'fastmail.com', 'hey.com', 'qq.com', 'naver.com',
  // Real domains that sit one edit from a bigger one. Listed so they're
  // matched exactly rather than "corrected" into somebody else's provider.
  'email.com', 'ymail.co.uk', 'gmx.de', 'web.de', 'comcast.net', 'verizon.net',
] as const

/** Top-level domains ordinary enough that we never second-guess them. */
const KNOWN_TLDS = new Set([
  'com', 'org', 'net', 'edu', 'gov', 'io', 'co', 'me', 'app', 'dev', 'ai',
  'uk', 'us', 'ca', 'au', 'ng', 'za', 'ke', 'gh', 'de', 'fr', 'es', 'it',
  'nl', 'se', 'no', 'ie', 'in', 'br', 'jp', 'cn', 'info', 'biz', 'xyz',
  'online', 'site', 'shop', 'agency', 'studio', 'design', 'tech', 'cloud',
])

/**
 * Edit distance where a swap of two neighbours counts as one mistake, not two.
 *
 * Plain Levenshtein calls "gmial" two edits from "gmail", which puts the single
 * most common typo there is outside a tight threshold. Counting a transposition
 * as one keeps the threshold tight enough to avoid false alarms while still
 * catching the fingers-out-of-order case.
 *
 * Capped: once every cell in a row is past the cap, no later row can come back
 * under it, so we stop.
 */
function distance(a: string, b: string, cap: number): number {
  if (Math.abs(a.length - b.length) > cap) return cap + 1
  const cols = b.length + 1
  let twoBack: number[] = []
  let prev: number[] = Array.from({ length: cols }, (_, i) => i)

  for (let i = 1; i <= a.length; i++) {
    const row = new Array<number>(cols)
    row[0] = i
    let best = i
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      let v = Math.min((row[j - 1] ?? 0) + 1, (prev[j] ?? 0) + 1, (prev[j - 1] ?? 0) + cost)
      // Neighbours swapped — one mistake, however it reads.
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        v = Math.min(v, (twoBack[j - 2] ?? 0) + 1)
      }
      row[j] = v
      if (v < best) best = v
    }
    if (best > cap) return cap + 1
    twoBack = prev
    prev = row
  }
  return prev[b.length] ?? cap + 1
}

/** Splits once on the LAST @, which is the one that separates local from domain. */
function parts(email: string): { local: string; domain: string } | null {
  const at = email.lastIndexOf('@')
  if (at <= 0 || at === email.length - 1) return null
  return { local: email.slice(0, at), domain: email.slice(at + 1).toLowerCase() }
}

/**
 * A corrected address when the domain looks like a slip, or null when there's
 * nothing to say. Never throws, and never returns the input unchanged.
 *
 * @example suggestEmailFix('ada@gmail.con') // 'ada@gmail.com'
 * @example suggestEmailFix('ada@ruff.agency') // null
 */
export function suggestEmailFix(email: string): string | null {
  const trimmed = email.trim()
  const p = parts(trimmed)
  if (!p) return null
  const { local, domain } = p

  // A domain we know is fine, exactly as typed. Nothing to suggest.
  if ((KNOWN_DOMAINS as readonly string[]).includes(domain)) return null

  // A near-miss on a big provider. Short domains get a tighter cap, because at
  // two edits "mail.com" and "gmail.com" stop being distinguishable.
  let best: { domain: string; d: number } | null = null
  for (const known of KNOWN_DOMAINS) {
    const cap = known.length <= 9 ? 1 : 2
    const d = distance(domain, known, cap)
    if (d <= cap && (!best || d < best.d)) best = { domain: known, d }
  }
  if (best) return `${local}@${best.domain}`

  // Not a known provider, so the domain itself is none of our business — but a
  // TLD one keystroke off "com" is still worth raising. ".co" is excluded: it's
  // a real TLD that plenty of businesses use deliberately.
  const labels = domain.split('.')
  const tld = labels[labels.length - 1] ?? ''
  if (!tld || KNOWN_TLDS.has(tld)) return null
  if (distance(tld, 'com', 1) <= 1) {
    return `${local}@${[...labels.slice(0, -1), 'com'].join('.')}`
  }
  return null
}

/**
 * Whether an address is shaped like one at all.
 *
 * Deliberately loose — the server validates with Zod, and the job here is to
 * avoid telling someone their address is wrong while they're still typing it.
 */
export function looksLikeEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())
}
