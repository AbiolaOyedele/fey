#!/usr/bin/env node
/**
 * Sends an in-app "new release" notification to every Fey user, for the latest
 * entry in src/data/changelog.json. Run AFTER scripts/sync-whats-new.mjs.
 *
 * Recipients are the distinct user_ids in `workspace_members` — the same set the
 * rest of the notification system writes to.
 *
 * Re-running is safe: it skips anyone who already has a product_update
 * notification for this version, so a partial run can be resumed.
 *
 * Pass --dry-run to print what would be sent without writing anything.
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

const dryRun = process.argv.includes('--dry-run');

const headers = {
  'Content-Type': 'application/json',
  'apikey': SUPABASE_SERVICE_ROLE_KEY,
  'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
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

const version = latest.version;

// Recipients: every distinct member across all workspaces.
const members = await req('GET', '/workspace_members?select=user_id');
const userIds = [...new Set(members.map((m) => m.user_id).filter(Boolean))];

// The version rides in entity_type because entity_id is a uuid column and a
// release has no row of its own to point at.
const entityType = `release:${version}`;

// Skip anyone already notified about this version (makes re-runs idempotent).
const existing = await req(
  'GET',
  `/notifications?select=recipient_id&type=eq.product_update&entity_type=eq.${encodeURIComponent(entityType)}`,
);
const already = new Set(existing.map((n) => n.recipient_id));
const targets = userIds.filter((id) => !already.has(id));

console.log(`v${version} — "${latest.title}"`);
console.log(`${userIds.length} users, ${already.size} already notified, ${targets.length} to send.`);

if (targets.length === 0) { console.log('Nothing to do.'); process.exit(0); }

const featureCount = (latest.features ?? []).length;
const rows = targets.map((recipient_id) => ({
  recipient_id,
  workspace_id: null,
  actor_id: null,
  type: 'product_update',
  title: `Fey v${version} is here`,
  body: featureCount
    ? `${latest.title} — ${featureCount} new thing${featureCount === 1 ? '' : 's'} to explore.`
    : latest.title,
  link: '/settings',
  entity_type: entityType,
  entity_id: null,
}));

if (dryRun) {
  console.log('\n--dry-run — nothing written. Sample row:');
  console.log(JSON.stringify(rows[0], null, 2));
  process.exit(0);
}

await req('POST', '/notifications', rows);
console.log(`✓ Notified ${rows.length} user${rows.length === 1 ? '' : 's'}.`);
