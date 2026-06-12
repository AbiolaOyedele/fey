# Fey — Handover Note

**Last updated:** 2026-06-12
**Production:** https://dashboard.theruff.agency (demo mode OFF — real Supabase)
**Latest commit deployed:** `7d3d25d`
**Status:** Invite links + reload→`/setup` loop both fixed at root cause and live. TypeScript clean (`npx tsc --noEmit` = 0 errors).

---

## Checkpoint — where we are right now

This session shipped the client-portal invite system, **fixed the broken invite
links**, and **fixed the reload loop at its root cause**. All work below is deployed.

### Commits this session (newest first)

| Commit | What |
|---|---|
| `7d3d25d` | **Invite link routing fix** — links now resolve to the join form (path-based URL) instead of the portal dashboard. `/setup` sets `portal_active: true`. |
| `8852b65` | **Reload race fix** — `SettingsProvider` now consumes `useAuth()` instead of resolving the session a second time. The real fix for the reload loop. |
| `a15dcc5` | `workspace_slug` added as the primary setup-completion signal in AppShell + `Settings` type + DEFAULTS. Defensive; complements the race fix. |
| `d02d314` | Cleanup — extracted shared helpers (`buildInviteUrl`, `mergeLocalFlags`, `usePortalAuth`, `usePortalBranding`). |
| `c893315` | Portal: invite codes, portal-JWT auth fix across 7 pages, first reload-to-setup attempt. |

---

## The invite-link bug — root cause (resolved)

Clicking an invite link showed the **portal dashboard**, not a signup form, at a URL
like `dashboard.theruff.agency/portal/signup?code=<UUID>`. Two independent defects:

1. **`clients/[id]/layout.tsx` "Copy invite link"** (the ⋯-menu button actually being
   used) built the URL by hand: wrong column (`portal_subdomain`, always null →
   empty slug), the **contact UUID** as the code, and the old `/signup` path. Empty
   slug → `/portal/signup?code=<uuid>`, which Next resolves to `[subdomain]="signup"`.
   The portal layout treats any path ending in `/signup` as public, so it rendered
   the **dashboard** with no auth. Now it calls the invite API and copies the
   returned `invite_url` — same single source of truth as the other two consumers.

2. **`buildInviteUrl`** emitted `https://<slug>.theruff.agency/join` — but **subdomain
   routing is not wired** (no middleware/rewrite, no root `/join` route), so that URL
   404s. Switched to the **path-based** form `<host>/portal/<slug>/join?code=...`,
   which hits `/portal/[subdomain]/join` directly and resolves. `portal-settings`
   fallback + "Portal URL" card updated to match.

Also: signup is gated by `portal_active` (workspace) + `portal_enabled` (contact).
Fey's `/setup` never set `portal_active`, so the API rejected every client with
`PORTAL_INACTIVE`. `/setup` now sets `portal_active: true` (mirrors Workboard). The
existing `bigbb` workspace + its contacts were enabled directly in the DB (one-time).

**Working invite link form:** `https://dashboard.theruff.agency/portal/<slug>/join?code=<8-char-code>`

**Files:** `src/app/api/v1/crm/contacts/[contactId]/invite/route.ts`,
`src/app/clients/[id]/layout.tsx`, `src/app/clients/[id]/portal-settings/page.tsx`,
`src/app/setup/page.tsx`.

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
| Invite links resolve to join form | ✅ Fixed — path-based URL, verified end-to-end |
| Google OAuth / PKCE callback | ✅ `/auth/callback`, waits for SIGNED_IN when `?code=` present |
| Portal invite code system | ✅ 8-char codes, GET/POST API, copy UI. `invite_code` column live in DB |
| "Copy invite link" (contact ⋯ menu) | ✅ Now calls the invite API (was the broken one) |
| Add Contact modal → invite link | ✅ Success step shows link + copy |
| Portal settings page → invite link | ✅ Short code + URL + regenerate |
| Portal sidebar (Dashboard + Workspace) | ✅ |
| Workspace hub page | ✅ Grid cards to all sections |
| `/portal/[slug]/join?code=` route | ✅ Re-exports signup page; `/join` is a public path |
| Portal pages auth (localStorage JWT) | ✅ All 7 pages use `portalTokenKey(subdomain)` |
| Login branding + "joined" banner | ✅ |

---

## Outstanding action items

### 1. No SQL outstanding ✅

The `crm_contacts.invite_code` column exists in the DB (codes are live, e.g.
`A2CDAEE7`). The old `fey_onboarding_complete` UPDATE is moot — the reload fix
derives completion from `workspace_slug`.

### 2. Vercel env vars

- `PORTAL_JWT_SECRET` — `.env.local` still has the placeholder
  `replace_with_output_of_openssl_rand_-base64_32`. Generate with
  `openssl rand -base64 32` and set on Vercel:
  `vercel env add PORTAL_JWT_SECRET production`. **Portal login fails until this is a
  real value in production.** (Confirm whether prod already has one set — if portal
  login currently works in prod, a value is already configured there.)
- `NEXT_PUBLIC_ROOT_DOMAIN=theruff.agency` — set in `.env.local`. No longer used for
  invite URLs (those are now derived from the request host), but harmless to set.

### 3. Per-contact portal access is opt-in

Signup requires `portal_active` (workspace) **and** `portal_enabled` (contact).
`/setup` now sets `portal_active: true` for new workspaces. But each **new contact**
defaults to `portal_enabled = false` — the owner must toggle "Portal access" ON in
the contact's **Portal Settings** tab before that client's invite link works.
(Consider defaulting new contacts to enabled, or auto-enabling when a link is first
copied, to remove this footgun — deferred, would change behavior.)

### 4. Subdomain routing — future enhancement (optional)

Branded URLs like `bigbb.theruff.agency/join` do **not** work — there is no
middleware/rewrite mapping a host subdomain to `/portal/[subdomain]`, and no root
`/join` route. Invite links are intentionally **path-based**
(`dashboard.theruff.agency/portal/<slug>/join?code=...`) and work today. To get the
prettier subdomain form later: add `src/middleware.ts` that rewrites
`<slug>.theruff.agency/<path>` → `/portal/<slug>/<path>`, **excluding** `dashboard`,
`www`, apex, `/_next`, and `/api`. Then `buildInviteUrl` can switch back to the
subdomain form.

---

## What to test next

1. **Invite flow (works now)** — the live links are
   `dashboard.theruff.agency/portal/bigbb/join?code=A2CDAEE7` (Biggy) and
   `...?code=1636970E` (Biiiiii). Open → fill name/email/password → submit →
   redirected to login with "Account created" banner → sign in → portal with
   Dashboard + Workspace sidebar. For a brand-new client, copy the link from the
   contact's ⋯ menu or Portal Settings.
2. **Reload fix** — hard-refresh `dashboard.theruff.agency` several times
   (Cmd+Shift+R first to drop the old bundle). Should land on the dashboard every
   time. Logged-out reload → `/login`. Brand-new account → `/setup` (correct).
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

### ⚠️ Invite URLs come from ONE place
The invite API (`/api/v1/crm/contacts/[contactId]/invite`) is the single source of
truth — it returns `{ invite_code, invite_url }`. **Never hand-build invite URLs** in
components. Doing so is what produced the `/portal/signup?code=<uuid>` bug (wrong
column, contact UUID as code, no subdomain segment → rendered the dashboard). All
three consumers (contact ⋯ menu, Portal Settings, Add Contact modal) call the API.
The URL is **path-based** (`<host>/portal/<slug>/join?code=<code>`) because subdomain
routing isn't wired — see Outstanding item #4.

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
