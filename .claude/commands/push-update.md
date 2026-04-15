# Push Update Workflow

Run this entire workflow automatically with no additional input. The user may optionally pass a version bump type (`major`, `minor`, or `patch`) and/or a short description as arguments — use them if provided, otherwise determine them automatically from the changes.

## Step 1 — Build

Run `npm run build`. If it fails, fix all errors and re-run until the build succeeds before continuing.

## Step 2 — Understand the changes

Run `git diff HEAD` and `git status` to get a full picture of every staged and unstaged change since the last commit.

## Step 3 — Read the current changelog from Supabase

The changelog lives in the `app_settings` table under `key = 'changelog'`. Its `value` column holds a JSON string with this shape:

```json
[
  {
    "version": "1.6.1",
    "date": "15 Apr, 2026",
    "features": [],
    "improvements": [],
    "fixes": ["..."]
  }
]
```

The first element in the array is always the most recent version. Read that to determine the current version number.

Query via the Supabase JS client or by running a curl request using the project's Supabase URL and anon key from `src/lib/supabase.js` / `.env`.

## Step 4 — Determine the next version

Parse the current version (semver: MAJOR.MINOR.PATCH).

- If the user passed a bump type (`major` / `minor` / `patch`), use it.
- Otherwise infer from the changes:
  - New user-facing features → **MINOR** bump
  - Bug fixes or small improvements only → **PATCH** bump
  - Breaking changes or major redesigns → **MAJOR** bump

## Step 5 — Categorise the changes

Group every change from Step 2 into one of three buckets:

- **New Features** — new functionality visible to the user
- **Improvements** — enhancements to existing functionality (performance, UX polish, refactors that affect behaviour)
- **Bug Fixes** — things that were broken and are now fixed

Write concise, user-facing descriptions (not "updated Tasks.jsx" — write "Fix delete bug where group cards remained visible after deletion").

## Step 6 — Update the changelog in Supabase

Prepend a new entry to the changelog array:

```json
{
  "version": "<next version>",
  "date": "<current day> <abbreviated month>, <current year>",
  "features": ["..."],
  "improvements": ["..."],
  "fixes": ["..."]
}
```

Upsert the updated JSON string back into `app_settings` where `key = 'changelog'`.

Also upsert `whats_new_active = 'true'` and `whats_new_version = '<next version>'` so the What's New popup fires on next load.

Also update the `version` key in `app_settings` to the new version string.

Use the Supabase client pattern already used in `src/contexts/SettingsContext.jsx`:
```js
await supabase.from('app_settings').upsert({ key, value: String(value) }, { onConflict: 'key' });
```

Run these as a Node.js script using the project's existing supabase client, or via direct REST calls with the project anon key.

## Step 7 — Commit and push

```bash
git add .
git commit -m "v<version> - <one-line summary of the release>"
git push
```

## Step 8 — Confirm

Print a short summary:

```
✅ v<version> pushed

New Features: <count>
Improvements: <count>
Bug Fixes: <count>

Commit: v<version> - <summary>
```
