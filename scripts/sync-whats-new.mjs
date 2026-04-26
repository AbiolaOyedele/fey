#!/usr/bin/env node
/**
 * Reads the latest entry from src/data/changelog.json and syncs it to Supabase:
 *   1. Upserts the entry into the `whats_new` table
 *   2. Updates `app_settings` so all users see the What's New badge
 *
 * Required env vars:
 *   SUPABASE_URL              — e.g. https://xxxx.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY — service role key (never the anon key)
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));
const changelog = JSON.parse(
  readFileSync(join(__dir, '../src/data/changelog.json'), 'utf8')
);

const latest = changelog[0];
if (!latest) { console.error('changelog.json is empty'); process.exit(1); }

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const headers = {
  'Content-Type': 'application/json',
  'apikey': SUPABASE_SERVICE_ROLE_KEY,
  'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
  'Prefer': 'resolution=merge-duplicates',
};

async function req(method, path, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

console.log(`Syncing v${latest.version} — "${latest.title}"…`);

// Upsert into whats_new (conflict on version column)
// The popup fetches the latest entry directly from this table — no per-user
// app_settings update needed.
await req('POST', '/whats_new', {
  version: latest.version,
  title: latest.title,
  features: latest.features,
  images: [],
});
console.log(`✓ whats_new upserted`);
console.log(`Done. v${latest.version} is live.`);
