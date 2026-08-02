#!/usr/bin/env node
/**
 * One-off: move base64 logos out of fey_settings and into Cloudinary.
 *
 * `fey_settings.logo` (and `avatar_url`) historically stored a data URL inline.
 * The logo is read on every portal page load, so a few hundred KB of base64
 * rode along with every request. New uploads already go to Cloudinary — this
 * fixes the rows that were saved before that change.
 *
 * Safe to re-run: rows whose value already looks like a URL are skipped.
 * Nothing is deleted — the column is overwritten with the new URL only after
 * the upload succeeds, so a failure leaves the original in place.
 *
 * Usage:  node scripts/migrate-logos-to-cloudinary.mjs [--dry-run]
 */

import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'

const DRY_RUN = process.argv.includes('--dry-run')

// ── env ─────────────────────────────────────────────────────────────────────
const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]
    }),
)

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY  = env.SUPABASE_SERVICE_ROLE_KEY
const CLOUD_NAME   = env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
const API_KEY      = env.CLOUDINARY_API_KEY
const API_SECRET   = env.CLOUDINARY_API_SECRET

for (const [name, value] of Object.entries({
  NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
  NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: CLOUD_NAME,
  CLOUDINARY_API_KEY: API_KEY,
  CLOUDINARY_API_SECRET: API_SECRET,
})) {
  if (!value) {
    console.error(`Missing ${name} in .env.local — cannot continue.`)
    process.exit(1)
  }
}

const headers = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }

// ── Cloudinary signed upload ────────────────────────────────────────────────
async function uploadDataUrl(dataUrl, publicId) {
  const timestamp = Math.floor(Date.now() / 1000)
  const params = { folder: 'fey/branding', public_id: publicId, timestamp }
  const toSign = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&')
  const signature = createHash('sha1').update(toSign + API_SECRET).digest('hex')

  const form = new FormData()
  form.append('file', dataUrl)
  form.append('api_key', API_KEY)
  form.append('folder', params.folder)
  form.append('public_id', publicId)
  form.append('timestamp', String(timestamp))
  form.append('signature', signature)

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
    method: 'POST',
    body: form,
  })
  if (!res.ok) throw new Error(`Cloudinary ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const json = await res.json()
  return json.secure_url
}

// ── main ────────────────────────────────────────────────────────────────────
const res = await fetch(`${SUPABASE_URL}/rest/v1/fey_settings?select=user_id,logo`, { headers })
if (!res.ok) {
  console.error(`Could not read fey_settings: ${res.status}`)
  process.exit(1)
}
const rows = await res.json()

let moved = 0
let skipped = 0
let failed = 0

for (const row of rows) {
  const logo = row.logo
  if (!logo || !logo.startsWith('data:')) { skipped++; continue }

  const kb = Math.round(logo.length / 1024)
  console.log(`${row.user_id}: ${kb} KB base64${DRY_RUN ? ' (dry run)' : ''}`)
  if (DRY_RUN) { moved++; continue }

  try {
    const url = await uploadDataUrl(logo, `logo-${row.user_id}`)
    const patch = await fetch(`${SUPABASE_URL}/rest/v1/fey_settings?user_id=eq.${row.user_id}`, {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ logo: url }),
    })
    if (!patch.ok) throw new Error(`PATCH ${patch.status}: ${(await patch.text()).slice(0, 200)}`)
    console.log(`  → ${url}`)
    moved++
  } catch (err) {
    console.error(`  ✗ ${err.message}`)
    failed++
  }
}

console.log(`\n${moved} moved · ${skipped} already fine · ${failed} failed`)
if (failed > 0) process.exit(1)
