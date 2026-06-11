# Fey — Handover Note

**Date:** 2026-06-10
**Status:** App running, demo mode active, all TypeScript errors zero

---

## What This Project Is

Fey is a freelancer productivity app. Features: client management, task tracking, invoicing, payments overview, a WhatsApp-connected AI assistant ("Fey"), campaign tracking, file uploads/versioning, and a shared-link client portal.

**Tech stack:**

| Concern | Value |
|---|---|
| Framework | Next.js 16.2.6 (App Router, all `'use client'`) |
| Language | TypeScript strict mode — `noImplicitAny`, `noUnusedLocals`, `exactOptionalPropertyTypes` |
| Styling | Tailwind CSS v4 — all tokens in `src/app/globals.css`, no `tailwind.config.ts` |
| Auth + DB | Supabase (project: `ajpzbntxooowpnwgkhcu`) |
| File storage | Cloudinary |
| Icons | lucide-react |
| Drag & drop | @dnd-kit |
| PDF export | html2canvas + jsPDF |

---

## Running the App

```bash
npm run dev
# → http://localhost:3000
```

**Demo mode is currently ON** (`NEXT_PUBLIC_DEMO_MODE=true` in `.env.local`). The app runs entirely in-memory with no Supabase connection — safe for UI review. Demo data: Nova Studio, Peak Agency, Bloom Co, etc.

To switch to real Supabase data, remove that line and log in at `/login` with `heyyabiola@gmail.com`.

Your real Supabase user ID: `45088dcd-d5a9-4125-a571-b8ab31505afc`

---

## What Was Done This Session

### Bug fixes
- **`FilePreviewModal`** — now accepts `ClientFile | TaskFile` union. Removed all `as unknown as` casts. Added `uploadError` state that surfaces Cloudinary failures to the user.
- **Cloudinary edge function** — replaced silent `!` non-null assertions with explicit HTTP 500 when env vars are missing.

### UI overhaul (visual only, no data logic changed)

**Clients page**
- List view is now the default (was grid)
- List rows redesigned: `h-12`, 32px avatar, client name, `Active`/`Completed`/`Idle` status badge, progress bar
- List container: `bg-white rounded-2xl border border-gray-100 shadow-sm`

**Dashboard**
- Heading reduced to `text-[20px] font-normal text-gray-700`
- Right panel slimmed to activity chart + "This Month" stat card only (removed profile card and client list)
- Fey nav item set to `subtle` (70% opacity when inactive)

**Payments page**
- Month labels: `text-base font-medium` (no pill)
- Client group headers: `h-9`, `text-[13px]`, `w-6 h-6 rounded-md` avatar
- Task rows: paid = `text-success`, pending = `text-amber-500`

**Global consistency (all pages)**
- All page `<h1>` → `text-2xl font-semibold text-gray-900`
- All primary buttons → `rounded-full`
- All empty states → standardised: `size={32}` icon, `text-[15px]` heading, `text-[13px]` subtitle, `rounded-full` CTA

**Other**
- `devIndicators: false` in `next.config.ts` — Next.js dev badge removed

### Demo mode wiring
- `useAuth()` no longer throws outside `AuthProvider` — returns a safe null stub so pages don't crash in demo mode
- `useSupabaseData()` now reads from `DemoDataContext` when `IS_DEMO` is true — pages get demo clients/tasks automatically without knowing about the split

### Design doc
- `design.md` fully updated: correct file paths, Tailwind v4 notes, new button/list row/empty state patterns, current screen inventory

---

## Architecture — Key Files

```
src/
  app/                        # All routes ('use client' throughout)
    page.tsx                  # Dashboard
    clients/page.tsx          # Clients list (list-first)
    clients/[id]/page.tsx     # Client workspace
    payments/page.tsx
    invoices/page.tsx
    tasks/page.tsx
    fey/page.tsx
    settings/page.tsx
  components/
    layout/
      AppShell.tsx            # Shell wrapper — shows/hides sidebar per route
      Sidebar.tsx             # 72px icon nav, supports subtle prop
    ui/                       # All feature components
      FilePreviewModal.tsx    # Accepts PreviewableFile = ClientFile | TaskFile
  contexts/
    AuthContext.tsx           # useAuth() — returns null stub when outside AuthProvider
    SettingsContext.tsx       # Central hub: settings, trash, toasts, currency
    DemoContext.tsx           # In-memory demo; exposes DemoDataContext
  hooks/
    useSupabaseData.ts        # Returns demoCtx data when IS_DEMO, real data otherwise
    useTaskGroupData.ts
    useDemoData.ts
  lib/
    constants.ts              # IS_DEMO, CURRENCY_SYMBOLS
  config/
    env.ts                    # Zod-validated env — only place process.env is read
  types/
    index.ts                  # Task, Client, Campaign, TaskGroup, Invoice, etc.
supabase/
  migrations/                 # SQL migrations
  functions/                  # Deno edge functions (excluded from tsconfig)
design.md                     # Design system reference — keep updated
```

---

## Known Patterns and Gotchas

### Dynamic route params (React 19)
```tsx
export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
```

### `useAuth()` outside `AuthProvider`
Returns `AUTH_STUB` (all nulls/no-ops) — safe to call on any page. In demo mode, `user` is null, which is fine because `IS_DEMO` gates all data hooks before `userId` is needed.

### `useSupabaseData()` dual mode
In demo mode (`IS_DEMO === true`): returns data from `useDemoDataCtx()`.
In real mode: fetches from Supabase using `userId`.
Pages never need to know the difference.

### Accent color
Never hardcode `#ED64A6`. Always use `var(--accent)` in CSS or `style={{ color/backgroundColor: accent }}` in components where `accent` comes from `useSettings()`.

### Tailwind v4
No `tailwind.config.ts`. All tokens (`--color-primary`, `--color-success`, `--color-appbg`, etc.) are in `src/app/globals.css` under `@theme {}`.

### TypeScript strictness
- `exactOptionalPropertyTypes` is ON — `prop?: string` and `prop?: string | undefined` are not interchangeable
- No `any` — use `unknown` and narrow
- Unused locals/params fail the build — prefix with `_` if intentionally unused

### Supabase edge functions
Live in `supabase/functions/` as Deno code. Excluded from `tsconfig.json`. Deploy with `supabase functions deploy`.

---

## Environment Variables (`.env.local`)

```
NEXT_PUBLIC_DEMO_MODE=true          # Remove this line to use real Supabase

NEXT_PUBLIC_SUPABASE_URL=https://ajpzbntxooowpnwgkhcu.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...

NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=diud4qb2x
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=fey_uploads
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...

NEXT_PUBLIC_BOT_URL=https://ruff-workboard.up.railway.app
```

---

## Seeded Test Data (on remote Supabase)

5 clients were inserted for `heyyabiola@gmail.com` to test the UI with real data:

| Client | Status | Tasks |
|---|---|---|
| Acme Corp | Active | 2 done, 2 pending |
| Bright Studio | Completed | 3 done, all paid |
| Cloud Nine Ltd | Idle | No tasks |
| Delta Media | Active | 2 pending |
| Echo Ventures | Active | 1 done, 1 pending |

---

*Ready to build new features.*
