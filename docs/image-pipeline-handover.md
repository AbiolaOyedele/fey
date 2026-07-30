# Image Pipeline — Developer Handover

**Module:** Image Pipeline (a "corner" of the Fey Playground)
**What it does:** Upload a reference image **or** just type a prompt → Claude refines the prompt → Gemini/Nano Banana renders a **1K preview** → user approves → **2K final**. Credit-metered, preview-first, approve-to-finalize.
**Status:** **Batch 1 complete** (mock-data frontend, reviewed + refined). **Batch 2 not started** (real backend/DB/AI).
**Spec of record:** `~/Downloads/CLAUDE.md` (the original build brief). This module intentionally conforms to Fey's conventions where they differ from the spec — see **Key decisions**.

---

## Live preview (mock data)

- **https://fey-image-pipeline.vercel.app/playground/image-pipeline**
- Mirror (same build): https://fey-ruff-tools.vercel.app/playground/image-pipeline

Notes:
- Preview only — **not** production. Sign in with a normal Fey/Supabase account, then go **Playground → Image Pipeline**. (Vercel may show its own preview-auth gate first.)
- **Generated images show as blank boxes** on the preview — the mock uses `picsum.photos`, which is network-blocked in some sandboxes. Layout/flow are correct; real Cloudinary assets fill them in Batch 2.
- To refresh the link after new work: `vercel deploy --yes` then `vercel alias set <deployment> fey-image-pipeline.vercel.app` (and `fey-ruff-tools.vercel.app`).

---

## What's done (Batch 1)

Full mock-backed frontend, typechecks clean (strict + `exactOptionalPropertyTypes`), lints clean, `npm run build` green, browser-verified at 375 / 768 / 1280.

**Pages** (`src/app/playground/image-pipeline/`)
- `layout.tsx` — shared chrome: header, live credit badge, section tabs. Wraps everything in `PipelineProvider` (shared context).
- `page.tsx` — **Generate**: reference upload (optional) + prompt field → prompt gate → preview approve/reject/edit → 2K final (download + lightbox). Retention chooser, channel selector, per-action + status-transition toasts.
- `gallery/page.tsx` — finals / in-progress / rejected, status filter, expiry countdowns, download, click-to-enlarge.
- `credits/page.tsx` — balance, allocation cadence, ledger history, request-credits form.
- `admin/page.tsx` — gated (super admin OR workspace owner): cost dashboard, credit-request queue, collapsible user accordion (tiers/allocations/grants), collapsible rates editor.

**Components** (`src/components/features/image-pipeline/`) — `ReferenceUploader`, `ChannelSelector`, `PromptGate`, `PreviewStage`, `GenerationTile`, `ImageLightbox`, `StatusPill`, `CreditBadge`, `ExpiryCountdown`, `PipelineNav`, `RequestCreditsForm`, `format.ts`, `download.ts`, and `admin/{AdminUserTable,CostDashboard,CreditRequestQueue,RatesPanel}.tsx`.

**Hooks** (`src/hooks/`) — `useImagePipeline` (generate flow), `useImagePipelineContext` (**shared provider** — admin flags, tier, retention, balance, channels), `useImageCredits`, `useImageGallery`, `useImagePipelineAdmin`.

**Contract** (`src/types/image-pipeline.ts`) — the single source of truth: enums, entities, API request/response shapes, product constants, and **repository interfaces**.

**Mocks** (`src/mocks/image-pipeline/`) — `store.ts` (in-memory seed + pub/sub), `repositories.ts` (implements the contract's repo interfaces exactly), `pipeline.ts` (the service/API facade the hooks call — tier resolution, credit charges, the two-gate state machine, admin ops), `index.ts` (barrel + plain-English error mapping).

**Refinements applied after first review**
- Download = fetch→blob save (real file, never a new tab); click any image to enlarge (`ImageLightbox`).
- Recolored to Fey brand tokens **only**: accent pink `#ED64A6` + neutral grays + soft-red danger `#E53E3E`. **No green/blue/emerald/amber.**
- Admin user list + rates are **collapsible/accordion** (scales to 30+ members).
- `active:scale` press states on all buttons + a toast on every action and status transition.
- Retention: default **2 weeks**, user-selectable 1 or 2; **rejected images are retained** until expiry (no immediate delete).
- Images are **optional** — a prompt alone works; Claude refines it.
- Admin gate = **super admin OR workspace owner** (not member-admins).
- Fixed a stale-header-balance bug via a shared `PipelineProvider`.

---

## Architecture & the mock→real seam

Layering (Fey rule): **routes → services → repositories**; components/hooks never touch the DB or AI directly.

The hooks import **only** from `@/mocks/image-pipeline` today. That barrel is the seam:
- **Batch 2 swap:** rewrite each hook's body to call `apiFetch('/api/v1/image-pipeline/...')`. The hook signatures and every page/component stay unchanged.
- `mocks/repositories.ts` already implements the exact repo interfaces from `types/image-pipeline.ts`; the real Supabase repos implement the same interfaces — an import change only.
- Realtime is faked with a tiny pub/sub in `store.ts` (`subscribeGeneration`). Batch 2 replaces it with a Supabase channel; `useImagePipeline` already subscribes the same way.

Fey conventions this module follows: Bearer-token auth via `requireAuth`/`verifyToken` → `getUser()`; owner scope via `resolveOwnerContext`; error shape `{ error: { code, message } }` via `handleError`; env via the single Zod schema in `src/config/env.ts`; client-signed Cloudinary uploads via `/api/v1/uploads/sign`.

---

## Key decisions (already made — don't re-litigate)

- **Tenancy:** per-user **and** workspace-aware — every owned row carries `user_id` **and** `owner_id`. Credits/generations belong to the user; the workspace owner/super admin can administer members.
- **No `profiles` table** in Fey (the spec assumed one). `image_tier_override` / `skip_prompt_review` / `retention_weeks` live on a new **`ip_user_settings`** table instead.
- **Admin = super admin OR workspace owner.** In Fey, "super admin" is the existing **`ADMIN_EMAILS` allowlist** (`isAdminEmail`, server-side) that already gates the `/admin` board. Context exposes `is_super_admin` + `is_workspace_owner`.
- **Reference image** uses Fey's existing client-signed Cloudinary flow; AI-generated images upload server-side (Batch 2).
- **Colors:** brand tokens only (see refinements). Keep it that way.
- **Credits:** 1 run = 0.25 preview + 0.75 final. All balance changes must go through the `ip_charge_credits` SECURITY DEFINER function — **no credit math in app code.**

---

## Super admin — DECIDED: option A

Super admin = the existing **`ADMIN_EMAILS`** allowlist (`isAdminEmail`, server-side, already app-wide). No new role or table.
- Batch 2 resolves `is_super_admin` on the server from `isAdminEmail(user.email)` and returns it in the pipeline context (the mock already exposes the flag).
- **The owner's own email must be in `ADMIN_EMAILS`** (`.env.local` / Vercel env) to get super-admin access.
- Workspace owners still administer their own workspace via `is_workspace_owner`.

---

## What to do next (Batch 2 — real backend)

Follow the spec's build order. Nothing here starts until Batch 1 is signed off and the super-admin decision is made.

1. **Migrations** — create the tables + RLS in one migration each (mirror `supabase/migrations/20260730_ruff_watermarks.sql` style, using `app_can_access_owner` / `app_can_manage_owner`):
   `ip_generations`, `ip_credit_ledger`, `ip_credit_allocations`, `ip_credit_requests`, `ip_rates_config`, `ip_user_settings`, `ip_flow_jobs`, `ip_worker_heartbeat`, plus the **`ip_charge_credits`** SECURITY DEFINER function (atomic balance check + ledger insert). Seed `ip_rates_config`. **The owner runs migrations** on Supabase.
2. **Env** — `ANTHROPIC_API_KEY` and `GEMINI_API_KEY` are already set in `.env.local` (gitignored, server-only). Extend the Zod schema in `src/config/env.ts` to validate them (both server-only, never `NEXT_PUBLIC_`). Still to add later: `FLOW_WORKER_API_KEY` (generated for the worker, Step 14). Add the two keys to Vercel env for deployed builds.
3. **AI clients** — `src/lib/anthropic.ts` (haiku-4-5 standard / sonnet-4-6 pro) + `src/lib/gemini.ts` (nano-banana 2.5-flash-image / nano-banana-pro). Timeout + single retry on 5xx/429.
4. **Services** — `services/image-pipeline/` : generation state machine, credits, tier resolution, rates, admin. Charge via `ip_charge_credits` at each step; on failure mark `failed` and refund the pending step.
5. **Real repositories** — `repositories/image-pipeline/` implementing the same interfaces; then swap the hook bodies to `apiFetch`. **No component changes.**
6. **API routes** — `app/api/v1/image-pipeline/**` wiring services; add a **rate-limit util** (none exists in the repo yet — spec wants 10 generation-starts/user/min) and cron routes (credit grants hourly, retention daily, flow-job janitor) guarded by `CRON_SECRET`.
7. **Realtime** — swap the mock pub/sub for a Supabase channel in `useImagePipeline`.
8. **Flow worker (Step 14, isolated & removable)** — desktop Playwright channel. **Do not reinvent the automation.** The owner's existing project is at `/Users/abiola/Documents/Abiola Personal Folder/flow_automation` (also holds the Gemini key). Port its Chrome-clone/Google-Flow approach. Worker uses a dedicated `FLOW_WORKER_API_KEY`, never the service-role key.

---

## Gotchas

- **Secrets:** server-only keys live in `.env.local` (gitignored) — `ANTHROPIC_API_KEY` and `GEMINI_API_KEY` are already set. Never commit them and never add `NEXT_PUBLIC_`.
- **`exactOptionalPropertyTypes` is on** — model nullable DB columns as `T | null`; for optional props that may be explicitly `undefined`, type them `x?: T | undefined`.
- **Auth gating:** the corner sits behind `AppShell`; to view pages while unauthenticated during dev, people temporarily add `/playground/image-pipeline` to `PUBLIC_ROUTES` in `AppShell.tsx` — **always revert it.**
- **Dev server:** `npm run dev` (Turbopack, port 4002 via `.claude/launch.json`). Never run dev servers through other tooling.
- **Never push to main.** All previews are `vercel deploy` (no `--prod`).

---

## Project memory

Durable context for this module lives in the owner's Claude memory at
`~/.claude/projects/-Users-abiola-Claude-Fey/memory/fey-image-pipeline-module.md`.
