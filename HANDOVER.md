# Fey — Handover Note

**Last updated:** 2026-06-12
**Production:** https://dashboard.theruff.agency (demo mode OFF — real Supabase)
**Latest commit deployed:** `8852b65`
**Status:** Reload→`/setup` loop fixed at root cause and live. TypeScript clean (`npx tsc --noEmit` = 0 errors).

---

## Checkpoint — where we are right now

This session shipped the client-portal invite system and **fixed the reload loop at
its root cause**. All work below is deployed to production.

### Commits this session (newest first)

| Commit | What |
|---|---|
| `8852b65` | **Reload race fix** — `SettingsProvider` now consumes `useAuth()` instead of resolving the session a second time. The real fix for the reload loop. |
| `a15dcc5` | `workspace_slug` added as the primary setup-completion signal in AppShell + `Settings` type + DEFAULTS. Defensive; complements the race fix. |
| `d02d314` | Cleanup — extracted shared helpers (`buildInviteUrl`, `mergeLocalFlags`, `usePortalAuth`, `usePortalBranding`). |
| `c893315` | Portal: invite codes, portal-JWT auth fix across 7 pages, first reload-to-setup attempt. |

---

## The reload→/setup bug — root cause (resolved)

Two earlier attempts treated symptoms. The actual bug was a **race between two
independent session resolutions**:

- `AuthContext` resolves `user` on the `INITIAL_SESSION` event — no DB call, fast.
- `SettingsContext` resolved its **own** `userId` via a second `getSession()` **and
  then** a DB roundtrip to load settings — strictly slower.

On first render `userId` was `null`, so the settings effect ran
`setSettingsLoading(false)` immediately — reporting "loaded" while settings were
still `DEFAULTS`. In that gap `AppShell` saw `loading === false` + truthy `user` +
default settings (`workspace_slug: ''`) and fired `router.replace('/setup')`. The
real row arrived a beat later, but the user was already parked on `/setup` (a public
route AppShell stops gating). It lost the race every time because it always did one
more async hop than AuthContext.

**Fix:** `SettingsProvider` sits inside `AuthProvider`, so it now consumes
`useAuth()` as the single source of truth and gates the load effect on `authLoading`.
`settingsLoading` can never report `false` until the real DB row is in hand. No SQL
required.

**Files:** `src/contexts/SettingsContext.tsx`, `src/components/layout/AppShell.tsx`,
`src/types/index.ts`, `src/data/demoData.ts`.

---

## Feature status

| Area | Status |
|---|---|
| Reload→`/setup` loop | ✅ Fixed at root cause (race), deployed |
| Google OAuth / PKCE callback | ✅ `/auth/callback`, waits for SIGNED_IN when `?code=` present |
| Portal invite code system | ✅ 8-char codes, GET/POST API, copy UI — **needs SQL (below)** |
| Add Contact modal → invite link | ✅ Success step shows link + copy |
| Portal settings page → invite link | ✅ Short code + URL + regenerate |
| Portal sidebar (Dashboard + Workspace) | ✅ |
| Workspace hub page | ✅ Grid cards to all sections |
| `/join?code=` route | ✅ Re-exports signup page |
| Portal pages auth (localStorage JWT) | ✅ All 7 pages use `portalTokenKey(subdomain)` |
| Login branding + "joined" banner | ✅ |

---

## Outstanding action items

### 1. SQL — required for invite codes (Supabase project `rwpyomkbzpmvbnbuduko`)

```sql
ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS invite_code TEXT UNIQUE;
```

Until this runs, invite codes cannot be generated or stored. **This is the only SQL
still needed** — the old `UPDATE fey_settings SET fey_onboarding_complete='true'`
workaround is no longer necessary, because the reload fix derives completion from
`workspace_slug` (which existing users already have) and no longer depends on that
flag.

### 2. Vercel env vars

- `PORTAL_JWT_SECRET` — `.env.local` still has the placeholder
  `replace_with_output_of_openssl_rand_-base64_32`. Generate with
  `openssl rand -base64 32` and set on Vercel:
  `vercel env add PORTAL_JWT_SECRET production`. **Portal login fails until this is a
  real value in production.**
- `NEXT_PUBLIC_ROOT_DOMAIN=theruff.agency` — set in `.env.local`; add to Vercel for
  correctness (prod currently falls back to the hardcoded `'theruff.agency'`, so
  invite URLs happen to be right, but set it explicitly).

### 3. Subdomain proxy

Confirm `[slug].theruff.agency` routes to `/portal/[slug]` (Vercel wildcard domain +
rewrite/middleware). Check `vercel.json` / middleware if not already wired.

---

## What to test next

1. **Reload fix** — hard-refresh `dashboard.theruff.agency` several times
   (Cmd+Shift+R first to drop the old bundle). Should land on the dashboard every
   time. Logged-out reload → `/login`. Brand-new account → `/setup` (correct).
2. **Invite flow (after SQL + JWT secret)** — create a client → copy invite link →
   open `/join?code=XXXXXXXX` → register → redirected to login with success banner →
   sign in → portal with Dashboard + Workspace sidebar.
3. **Portal sections** — messages, files, contracts, forms each load data using the
   portal client JWT (not the owner's Supabase session).

---

## What this project is

Fey is a freelancer productivity app: client management, task tracking, invoicing,
payments overview, a WhatsApp-connected AI assistant ("Fey"), campaign tracking,
file uploads/versioning, and a branded **client portal** (per-workspace subdomain,
invite codes, separate client auth).

| Concern | Value |
|---|---|
| Framework | Next.js 16.2.6 (App Router, all `'use client'`) |
| Language | TypeScript strict — `noImplicitAny`, `noUnusedLocals`, `exactOptionalPropertyTypes` |
| Styling | Tailwind CSS v4 — tokens in `src/app/globals.css` (`@theme`), no `tailwind.config.ts` |
| Owner auth + DB | Supabase (project `rwpyomkbzpmvbnbuduko`) |
| Portal client auth | Custom bcrypt + JWT in localStorage (`portal_token_${subdomain}`) |
| File storage | Cloudinary |
| Deployment | Vercel (`dashboard.theruff.agency`, wildcard `*.theruff.agency`) |
| Icons | lucide-react · DnD: @dnd-kit · PDF: html2canvas + jsPDF |

---

## Running the app

```bash
npm run dev          # → http://localhost:3000
npx tsc --noEmit     # must be 0 errors before any commit
```

Demo mode is **off** (`NEXT_PUBLIC_DEMO_MODE=false`). The app talks to real Supabase.
Owner login: `heyyabiola@gmail.com`. To review UI in-memory without Supabase, set
`NEXT_PUBLIC_DEMO_MODE=true`.

---

## Architecture — key files

```
src/
  app/
    page.tsx                       # Dashboard
    setup/page.tsx                 # Fey onboarding (name → workspace_slug)
    auth/callback/route.ts         # PKCE code exchange for Google OAuth
    clients/[id]/portal-settings/  # Owner: invite link + regenerate
    portal/[subdomain]/            # CLIENT portal (separate auth) ─────────┐
      page.tsx  workspace/  messages/  files/  contracts/  forms/          │
      login/  join/  signup/                                               │
    api/v1/
      crm/contacts/[contactId]/invite/route.ts   # GET/POST invite code    │
      portal/auth/{login,signup,session}/        # portal JWT issue/verify │
      portal/branding/                           # public workspace brand  │
  components/layout/
    AppShell.tsx                   # Owner shell + setup-redirect gate
    Sidebar.tsx
  contexts/
    AuthContext.tsx                # useAuth() — owner Supabase session (single source of truth)
    SettingsContext.tsx            # settings/trash/toasts/currency; consumes useAuth()
    DemoContext.tsx
  hooks/
    usePortalAuth.ts               # portalTokenKey(slug), usePortalToken(slug)
    usePortalBranding.ts           # public branding fetch (login/join pages)
    useSupabaseData.ts             # demo-or-real data switch
  config/env.ts                    # Zod-validated env — only place process.env is read
  types/index.ts                   # Settings (incl. workspace_slug), Client, Task, …
```

---

## Known patterns & gotchas

### ⚠️ Never resolve the auth session twice
`SettingsProvider` sits inside `AuthProvider` and **must** derive `userId` from
`useAuth()`. A second `supabase.auth.getSession()` there is exactly what caused the
reload→`/setup` race (it resolved slower than AuthContext and reported
`settingsLoading=false` with DEFAULT settings). Keep one source of truth.

### ⚠️ Two separate auth systems
- **Owner** = Supabase Auth (`useAuth()`, `supabase.auth.getSession()`).
- **Portal client** = custom bcrypt/JWT stored in `localStorage` under
  `portal_token_${subdomain}` (see `usePortalAuth.ts`).
- **Never** call `supabase.auth.getSession()` in `portal/[subdomain]/*` client pages —
  portal clients have no Supabase session.

### ⚠️ `fey_onboarding_complete` vs `onboarding_complete`
Fey owns `fey_onboarding_complete`; Workboard (shares the same Supabase DB) owns
`onboarding_complete`. Keep them separate so the two apps never gate each other.
`workspace_slug` (set during `/setup`) is the most reliable "setup done" signal.

### Dynamic route params (React 19)
```tsx
export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
```

### Accent color
Never hardcode `#ED64A6`. Use `var(--accent)` in CSS, or `style={{ … }}` with `accent`
from `useSettings()`.

### Tailwind v4
No `tailwind.config.ts`. Tokens (`--color-primary`, `--color-success`, `--color-appbg`,
…) live in `src/app/globals.css` under `@theme {}`.

### TypeScript strictness
`exactOptionalPropertyTypes` is ON · no `any` (use `unknown` + narrow) · unused
locals/params fail the build (prefix `_` if intentional).

### Banned UI pattern (per CLAUDE.md)
No status-badge / availability-pill / pulsing-dot chips. Do not build them.

---

## Environment variables (`.env.local`)

```
NEXT_PUBLIC_DEMO_MODE=false                 # true → in-memory, no Supabase
NEXT_PUBLIC_SUPABASE_URL=https://rwpyomkbzpmvbnbuduko.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

NEXT_PUBLIC_ROOT_DOMAIN=theruff.agency      # invite-URL host (also set on Vercel)
PORTAL_JWT_SECRET=...                        # ⚠️ placeholder locally — set real value on Vercel

NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=...
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

---

## Possible next features

- Real-time portal messages (Supabase Realtime subscription).
- Portal notifications badge on the Workspace nav item.
- Owner → client: send message / upload file from the owner's client page into the
  portal data tables.
