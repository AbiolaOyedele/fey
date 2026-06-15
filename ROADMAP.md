# Fey — MVP Roadmap & Work Queue

**Created:** 2026-06-15
**Owner:** Abiola (heyyabiola@gmail.com)
**Purpose:** A self-contained, ordered work queue an AI dev (or Claude) can execute
one item at a time without supervision, plus a list of things that need Abiola's
input or an external action (kept at the bottom).

**Ground rules for whoever works this list**
- Follow `CLAUDE.md` standards (typed, layered: routes→services→repositories, `AppError`,
  no `any`, no direct `process.env` outside `src/config/env.ts`, no banned status-pill UI).
- `npx tsc --noEmit` must be 0 errors before each commit. One feature per commit.
- Two auth systems: owner = Supabase Auth; portal client = bcrypt/JWT in localStorage.
  Never call `supabase.auth.getSession()` in `portal/[subdomain]/*` pages.
- Two "client" models still exist: dashboard `clients` vs `crm_contacts`. New work targets
  `crm_contacts` (the primary model) unless stated.
- Migrations that have already run must NOT be edited — add a new dated migration.

**Decisions already locked in (from Abiola, 2026-06-15)**
- Admin/metrics: **phased** — build a custom Supabase-backed admin board now; structure it so
  PostHog can be layered in later without rework.
- Feedback button: **both** — store submissions in Supabase (admin board, with status) AND
  email a copy to Abiola via Resend.
- Security: **prefer Vercel-native, free-tier only.** If a capability requires a paid plan,
  use the free alternative instead and flag it. Always do the free upload-hardening regardless.
- Projects: new top-level **Projects** entity that supersedes Campaigns conceptually — each
  project is a container ("folder") with its **own chat thread and file uploads**, visible in
  both the owner client page and the client portal.

---

## Progress log
- **A1 — DONE** (2026-06-15): `src/utils/formatDate.ts` added; 35 date sites swept to
  `formatDate`/`formatDateTime`; `relativeTime` fallback now `dd/mm/yyyy`; local helpers in
  fey/share/MessageThread reconciled. `tsc` clean. Month-year aggregation labels left as-is.
- **A2 — DONE** (2026-06-15): `RichTextComposer` link button now opens an in-app popup
  (URL + optional text, Zod `http(s)` validation, Enter/Esc, selection-aware). No more
  `window.prompt`. `tsc` clean.
- **A3 — PARTIAL** (2026-06-15): central upload policy (`MAX_UPLOAD_BYTES`,
  ALLOWED/BLOCKED extension lists in `constants.ts`) + `validateUploadFile()` enforced for
  every caller in `utils/cloudinary.ts`; config read via `@/config/env` (added
  `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET`); duplicate inline uploader in `clients/[id]/files`
  removed in favour of the shared util (now with error toast). **Still TODO:** switch the
  unsigned preset to *signed* uploads — deferred because it needs per-call auth wiring across
  BOTH owner (Supabase) and portal (custom JWT) callers + a Cloudinary dashboard change.
  See refined note below.

- **B2 — DONE** (2026-06-15): feedback button + modal (`components/ui/FeedbackButton.tsx`,
  mounted in `AppShell`, owner app only). `POST /api/v1/feedback` → `feedback.service`
  (Zod) → `feedback.repository` insert, then best-effort email to `ADMIN_EMAILS` via new
  `FeedbackEmail` template. Migration `20260615_feedback.sql` (table + RLS). **Owner action:**
  run the migration + set `ADMIN_EMAILS` on Vercel for the email copy (rows store regardless).
  Admin-board inbox view comes with B1.

- **B4 — PARTIAL** (2026-06-15): Archive for **clients** done — `archived_at` column
  (migration `20260615_archive.sql`), `CrmContact.archived_at` type, `setContactArchived`
  in `useContacts`, "Archived" filter on the clients list (archived hidden by default),
  Archive/Unarchive in the client detail ⋯ menu. **Still TODO:** archive for Projects (ships
  with B3), hide archived clients from the *portal* (needs portal-auth check), and exclude
  archived from dashboard "Needs attention" counts (`useCrmPending`). **Owner action:** run
  `20260615_archive.sql`.
- **B6 — PARTIAL** (2026-06-15): baseline security headers added in `next.config.ts`
  (nosniff, X-Frame-Options, Referrer-Policy, HSTS, Permissions-Policy). **Still TODO:** CSP
  (needs origin audit), Vercel WAF/BotID + endpoint rate-limiting (free tier), per the B6 spec.

- **B1 — DONE (custom board, phase 1)** (2026-06-15): admin board at **`/admin`**
  (`app/admin/page.tsx`), gated server-side by `ADMIN_EMAILS` (`isAdminEmail`).
  `GET /api/v1/admin/metrics` (service-role) → `admin.service.getMetrics` +
  `admin.repository` (defensive counts/sums/time-series across workspaces, clients, portal
  users, messages, files, invoices, contracts, forms, feedback) + signups-by-week.
  `PATCH /api/v1/admin/feedback/[id]` cycles feedback status (new→triaged→done). UI: stat
  cards + recharts bar chart + feedback inbox. `proxy.ts` maps `admin.<root>/` → `/admin`.
  AppShell treats `/admin` as standalone (no owner gating). **Owner action:** set
  `ADMIN_EMAILS`; (optional) point `admin.theruff.agency` DNS at the app. PostHog phase 2
  later (seam left in `admin.service`).

- **B3 — PARTIAL (owner side done)** (2026-06-15): Projects feature. Migration
  `20260615_projects.sql` (`projects` + `project_messages` + `project_files`, workspace-scoped,
  owner RLS, archived_at from the start). Types `src/types/project.ts`; hooks
  `src/hooks/useProjects.ts` (`useProjects` list/create/update/archive/delete + `useProject`
  detail with messages/files/send/upload). "Projects" tab in `ContactTabs`. Owner pages:
  `clients/[id]/projects` (list + create) and `clients/[id]/projects/[projectId]` (chat + files,
  reusing `MessageThread`/`FileList`, with archive). **Still TODO:** the **portal mirror** —
  portal API routes (service-role + ownership) for project list/messages/files, portal pages,
  and a Projects entry in `PortalWorkspaceTabs` so clients can open their projects. Campaigns
  left untouched (retirement is a Part D decision). **Owner action:** run
  `20260615_projects.sql`.

- **B3 — DONE (owner + portal)** (2026-06-15): the portal mirror shipped. New
  `portal-projects.repository.ts` + `portal-projects.service.ts` (Zod-validated, ownership +
  archived checks, service-role). Routes: `GET /api/v1/portal/projects`,
  `GET/.../[projectId]`, `POST /.../[projectId]/messages`, `POST /.../[projectId]/files`.
  Portal pages: `portal/[subdomain]/projects` (list) + `.../projects/[projectId]` (chat +
  files). "Projects" added to `PortalWorkspaceTabs`, `PortalShell` WORKSPACE_ROUTES, and the
  workspace hub. Opening a project marks the owner's messages read.
- **A5 / A6 — CODE-COMPLETE, pending SQL** (2026-06-15): read receipts + the active/last-seen
  indicator were already wired (session route touches `last_seen_at`; activity endpoint +
  `useContacts` merge + `ContactListRow` display; `markOwnerMessagesRead` + `portal_read_receipts`
  gate). They light up the moment the message-settings columns exist — included in the combined
  SQL. Fixed an admin-metrics bug (was querying a non-existent `crm_contacts.last_seen_at`).
- **B4 — DONE** (2026-06-15): archive finished — archived clients excluded from dashboard
  "Needs attention" (`useCrmPending`) and **blocked from the portal** (session route denies
  archived contacts). Project-level archive also shipped with B3.
- **SQL — combined file**: `supabase/migrations/RUN_ME_2026-06-15.sql` bundles all four
  migrations (message-settings, feedback, archive, projects) — run once.

## PART A — Fixes / hardening of the current MVP (do first)

### A1. Centralised date formatting → `dd/mm/yyyy`
- **Problem:** 56 `toLocaleDateString`/`toLocaleString` calls across ~36 files with mixed
  locales (`en-GB`, `en-US`, default). Inconsistent and not the requested `dd/mm/yyyy`.
- **Do:**
  1. Add `src/utils/formatDate.ts` exporting `formatDate(iso, opts?)` →
     `dd/mm/yyyy`, plus `formatDateTime` (`dd/mm/yyyy HH:mm`) and `formatDateLong`
     (e.g. `15 Jun 2026`) for places that want a friendly form. Pure, typed, null-safe.
  2. Keep `relativeTime()` for chat/feed, but its fallback branch (line 20) should call
     `formatDate` so old timestamps render `dd/mm/yyyy`.
  3. Replace the raw `toLocale*` calls across the files listed below with the new helpers.
     Audit each call site for intent (date vs date+time).
- **Files (non-exhaustive, from grep):** `src/app/page.tsx`, `clients/[id]/{payments,forms,
  invoices,contracts}/page.tsx`, `payments/page.tsx`, `fey/page.tsx`, `fey/[id]/page.tsx`,
  `portal/[subdomain]/{payments,messages,forms,invoices,contracts,files}/...`,
  `invoices/{page,new,[id]}`, `pay/[token]`, `invoice/[token]`, `share/[token]`,
  `components/ui/{MonthBadge,FilePreviewModal,InvoiceSendModal,TaskItem,SimpleTaskItem,NewInvoiceModal}`,
  `components/crm/{MessageThread,NotificationBell,FormBuilder,FileList,ContractBuilder,ClientSearchDialog}`,
  contexts `SettingsContext`/`DemoContext`.
- **Acceptance:** no remaining `toLocaleDateString`/`toLocaleString` for user-facing dates
  except inside the two date utils; every visible date reads `dd/mm/yyyy`.

### A2. In-app link popup in the message composer (replace `window.prompt`)
- **Problem:** `RichTextComposer.tsx:86` uses `window.prompt('Enter URL:')` — a system dialog.
- **Do:** build a small in-app popover/modal (reuse existing `sheet`/`dropdown-menu`/`Toast`
  primitives or a lightweight inline popover) with a URL field (+ optional link-text field),
  validate the URL with Zod (`z.string().url()`, allow `http(s)` only), then apply via the
  existing `execCmd('createLink', url)` path (or insert an anchor for selected text).
  Show an inline error for invalid URLs. Keyboard: Enter submits, Esc closes.
- **Acceptance:** clicking the link button opens an in-app popup, never the browser prompt;
  invalid URLs are rejected with a plain-English message.

### A3. File-upload hardening (free, do regardless of AV decision)
- **Problem:** `src/utils/cloudinary.ts` does **unsigned** client-side uploads with the preset
  exposed via `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET`; `auto/upload`; only a client-side 25 MB
  check; no MIME allowlist; reads `process.env` directly (CLAUDE.md violation).
- **Do:**
  1. Define a shared allowlist of extensions + MIME types and a size cap in one constant
     (`src/lib/constants.ts`). Enforce **both** extension and `file.type` client-side before
     upload (reject e.g. `.exe`, `.js`, `.html`, `.svg` unless explicitly allowed).
  2. Move to **signed uploads**: add `POST /api/v1/uploads/sign` (route→service) that returns a
     short-lived Cloudinary signature using `CLOUDINARY_API_SECRET` (server-only). Switch
     `uploadToCloudinary` to use the signature instead of the public unsigned preset. This stops
     anyone on the internet from uploading to your Cloudinary with the leaked preset.
  3. Read Cloudinary public config through `src/config/env.ts`, not inline `process.env`.
  4. Confirm Cloudinary stores with a generated `public_id` (it does) — keep original filename
     only as display metadata, never as the storage key.
- **Acceptance:** uploads are signed; disallowed types are blocked before hitting Cloudinary;
  no direct `process.env` in the util; `tsc` clean.
- **Note:** the actual antivirus scan is **A8** (gated on the free-tier decision below).

### A4. Apply the outstanding SQL (unblocks read receipts + last-active)
- Per HANDOVER, three columns were never applied. Create/verify a migration and run it:
  `portal_users.last_seen_at timestamptz`,
  `fey_settings.portal_read_receipts text default 'true'`,
  `fey_settings.message_retention_days text default '60'`.
- This unblocks A5 and A6. (Migration `20260612_message_settings.sql` already drafted — confirm
  it ran in prod; if not, run it. This is partly an **owner action** — see Part D.)

### A5. Message read indicators (finish the feature)
- **Spec from Abiola:** messages show a read/viewed indicator. A setting lets the owner choose
  whether clients can see the owner's read status. **Default: clients CAN see** that the owner
  has read their message, and the owner CAN see when clients read.
- **Status:** code is partially built (`portal_read_receipts` setting referenced in Settings,
  portal pages, `crm.repository`). Finish + verify after A4.
- **Do:** ensure a `read_at` (or equivalent) timestamp is written when the counterparty opens a
  thread; render "Sent → Read · dd/mm/yyyy HH:mm" on the sender's bubbles; gate the *owner's*
  read status visibility to clients behind `portal_read_receipts` (default true); the owner
  always sees client read status. Verify both directions in the portal and owner views.
- **Acceptance:** opening a thread marks the latest counterparty messages read; sender sees it;
  toggling the setting hides/show the owner's read state to clients.

### A6. "Active" indicator = real portal activity
- **Spec:** the active indicator should reflect when **clients are actually active on the
  portal**, not just whether portal access is enabled.
- **Do:** write `portal_users.last_seen_at = now()` on portal auth/session validation and on
  meaningful portal navigation (throttle to ~1/5 min). Replace the current "portal-active"
  proxy in `clients/page.tsx` / `ContactListRow.tsx` with `isActiveWithin(last_seen_at, …)`.
  Show "Active dd/mm/yyyy HH:mm" / "Active 5m ago" via `relativeTime`.
  **Do NOT** build a pulsing-dot/availability-pill (banned by CLAUDE.md) — use plain text.
- **Acceptance:** the indicator reflects last real portal visit; no banned pill UI.

### A7. Verify message-retention cron is live
- Cron exists (`api/v1/cron/prune-messages`) but is dormant until `CRON_SECRET` is set on
  Vercel. Confirm the env var + redeploy (owner action, Part D). Add a short log line so the
  admin board (B1) can show "last prune run / messages+files deleted".

---

## PART B — Requested new features

### B1. Personal admin / metrics portal (custom, Supabase-backed; PostHog-ready)
- **Goal:** an admin-only dashboard on your own subdomain showing product metrics + feedback.
- **Access control:** restrict to your owner account only. Add an `is_admin` check (env-based
  allowlist of admin emails via `src/config/env.ts`, e.g. `ADMIN_EMAILS`, or an `is_admin`
  column on the owner profile). Gate both the route and every admin API server-side. Never rely
  on client-side hiding alone.
- **Subdomain:** serve at `admin.theruff.agency`. The existing `src/proxy.ts` already maps
  subdomains — extend it to route `admin.*` → `/admin/*`, excluded from portal rewrites.
  (Confirm DNS/wildcard already covers it — Part D.)
- **Metrics (read directly from Supabase via a repository + service, NOT in the route):**
  - Total owners/workspaces, new signups over time (line chart — `recharts` already installed).
  - Active workspaces (recent owner login / activity).
  - Total clients (`crm_contacts`), portal users, portal active in last 7/30d (uses A6).
  - Messages sent (owner vs client), files uploaded + total storage, invoices created/paid,
    contracts sent/signed, forms sent/submitted.
  - Feedback inbox (from B2) with status filter.
  - Cron health line (from A7).
- **Build order:** `src/repositories/admin.repository.ts` (queries) → `admin.service.ts`
  (aggregation/shaping, typed response interfaces) → `app/api/v1/admin/metrics/route.ts`
  (auth-gated, calls service only) → `app/admin/page.tsx` (cards + charts, loading/empty/error
  states on every fetch, TanStack-style `staleTime` if Query is added — otherwise explicit
  cache headers).
- **PostHog-ready:** keep all metric reads behind the service layer so a future PostHog source
  can be added without touching the UI. Add a `// TODO(posthog)` seam in the service.
- **Acceptance:** only admin email(s) can load `/admin`; metrics render with all three states;
  no DB queries in the route; typed end-to-end.

### B2. In-app "Submit feedback / request" button (DB + email)
- **Goal:** a always-available button in the main owner app (and optionally the portal) that
  opens a small form (type: bug / feature / other; message; optional email auto-filled).
- **Do:**
  1. Migration: `feedback` table (`id, workspace_id, user_id, source 'owner'|'portal',
     type, message, page_url, user_agent, status 'new'|'triaged'|'done', created_at`) with RLS
     (owner can insert their own; admin can read all — admin read via service role in the API).
  2. `POST /api/v1/feedback` (route→service→repository): Zod-validate, insert row, then
     best-effort `email.service` send to Abiola (new React Email template in `emails/`). Both,
     per decision. Email failure must not fail the request.
  3. UI: a feedback button (e.g. in the owner top bar / sidebar footer) opening a modal. Plain
     success/error states. No PII in logs.
  4. Surface the feedback inbox + status controls in the admin board (B1).
- **Acceptance:** submitting stores a row AND emails Abiola; feedback appears in `/admin` with
  editable status; validation + error states present.

### B3. Projects (supersedes Campaigns) — container with own chat + files
- **Spec from Abiola:** "Campaigns is outdated. Projects should run like campaigns. A user opens
  a project and it has its own chat interface and file uploads — a way to keep everything for one
  project in one folder instead of scattered." Mirrored in the client portal.
- **Model:** new top-level `projects` entity scoped to a `crm_contact` (client) + workspace.
  - Migration: `projects` (`id, workspace_id, contact_id, title, description, status
    'active'|'on_hold'|'completed'|'archived', start_date, due_date, created_at, updated_at`).
  - Reuse the existing message + attachment patterns but scope them to a project: add
    `project_id` (nullable FK) to the message/attachment tables, or a dedicated
    `project_messages` / `project_files` if cleaner — decide during build, keep it consistent
    with current chat/file code (`crm.repository`, portal message/file APIs).
  - RLS on every new table; ownership checks in the service.
- **Owner UI:** a "Projects" section/tab on the client page (`clients/[id]/`) listing projects;
  opening one shows its own chat thread (reuse `MessageThread` + `RichTextComposer`) and its own
  file area (reuse `FileList`/`ClientFilesCard`). Create/edit/archive a project.
- **Portal UI:** mirror under `portal/[subdomain]/` — clients see their projects, each with the
  project chat + files. Add to `PortalWorkspaceTabs`.
- **Campaigns:** do **not** delete yet. Add to Part D the question of whether to migrate existing
  campaign data into projects and then retire the Campaigns UI. For now Projects is the forward
  path; leave Campaigns read-only/parked if it conflicts.
- **Acceptance:** owner and client can open a project and use a self-contained chat + file space;
  data is workspace+ownership scoped; dates render `dd/mm/yyyy`; states handled.

### B4. Archive function
- **Spec:** "Create Archive function." Interpreted as the ability to archive (hide without
  deleting) the main entities so the workspace stays clean: **clients (crm_contacts), projects
  (B3), and optionally message threads / files.** Confirm scope (Part D) — build for clients +
  projects first.
- **Do:**
  1. Add an `archived_at timestamptz` (nullable) to `crm_contacts` and `projects` (new
     migration). Archived = non-null.
  2. Default list views exclude archived; add an "Archived" filter/section to view + unarchive.
  3. Archive action in the ⋯ menus; confirm before archiving; toast on success/undo.
  4. Portal: archived clients/projects hidden from the client too.
- **Acceptance:** archiving removes an item from default views but preserves data and is
  reversible; nothing is hard-deleted.

### B5. File antivirus scanning (free-tier only — see Part D gate)
- **Goal:** scan uploaded files for malware before they're accessible.
- **Approach (free-tier):** on the signed-upload server route (A3), after Cloudinary stores the
  file, enqueue/perform a scan and mark the attachment `scan_status 'pending'|'clean'|'infected'`.
  Options that have a free tier — **pick during the Part D decision**:
  - Cloudmersive Virus Scan API (free tier, simple REST) — recommended for MVP.
  - VirusTotal public API (free, rate-limited; check ToS for commercial use).
  - Self-host ClamAV (free but needs a worker/container — more infra).
  - Cloudinary add-on AV scanning is **paid** — excluded by the free-tier rule.
- **Do:** add `scan_status` + `scan_at` columns to attachment tables; gate file delivery/preview
  on `clean`; show "Scanning…" then allow/deny. Quarantine `infected` (don't serve, notify
  owner). Keep the call best-effort + retryable.
- **Acceptance:** files are scanned before being served; infected files are blocked.
- **Gated:** needs the provider decision in Part D before implementing the network call; the
  schema + status plumbing can be built immediately.

### B6. Platform security — Vercel-native, free-tier
- **Goal:** the "Cloudflare security" ask, satisfied with Vercel's free-tier protections.
  Cloudflare-in-front-of-Vercel adds real complexity with the wildcard subdomain portal and is
  **not** done unless explicitly chosen (Part D).
- **Do (free):**
  - Enable Vercel **WAF** managed rules + a few custom rules (block obvious bad paths, basic
    rate-limit on auth/feedback/upload-sign endpoints). DDoS mitigation is automatic + free.
  - Add **BotID** on sensitive endpoints (portal login/signup, feedback, upload-sign) — use the
    free invisible/basic tier; do not assume Deep Analysis (may be paid).
  - App-level rate limiting on `api/v1/portal/auth/*`, `api/v1/feedback`, `api/v1/uploads/sign`
    using Vercel's runtime cache / a lightweight limiter (free) as a backstop.
  - Verify security headers (CSP where feasible, `X-Content-Type-Options`, `Referrer-Policy`,
    HSTS) via `next.config.ts` / middleware.
- **Acceptance:** WAF + bot protection active on sensitive routes via free-tier features only;
  any capability that turned out to need a paid plan is listed in Part D instead of enabled.

---

## PART C — Suggested additional fixes/improvements found while reading (optional, my recommendations)

- **C1. Reconcile the two client models.** Dashboard `clients` vs `crm_contacts` is a known
  source of confusion (HANDOVER architecture note). Plan a migration of the dashboard onto
  `crm_contacts` so "Add a client" shows up everywhere. (Larger; flag before doing.)
- **C2. Real-time portal messages** via Supabase Realtime (already listed as a "possible next
  feature" in HANDOVER) — improves the chat in messages + Projects.
- **C3. Portal notifications badge** on the Workspace / Projects nav items (unread counts).
- **C4. Consistent empty/loading/error states audit** across data-fetching components per
  CLAUDE.md — spot-check the new Projects/admin views especially.
- **C5. Replace `document.execCommand`** (deprecated) in `RichTextComposer` longer-term with a
  small maintained rich-text approach; fine for MVP but note the tech debt.

---

## PART D — Needs Abiola's input or an external action (do these / answer these)

### Decisions still open
1. **Archive scope (B4):** archive clients + projects only, or also message threads and
   individual files? (Building clients + projects first.)
2. **Campaigns retirement (B3):** migrate existing Campaign data into Projects then remove the
   Campaigns UI, or leave Campaigns parked indefinitely? Any live campaigns whose data must be
   preserved?
3. **Antivirus provider (B5):** confirm Cloudmersive free tier is acceptable (sign-up + free API
   key), or prefer VirusTotal / self-hosted ClamAV. I'll wire whichever you pick; until then I'll
   build the `scan_status` plumbing only.
4. **Admin access model (B1):** confirm using an `ADMIN_EMAILS` env allowlist (just your email)
   vs an `is_admin` DB column. Env allowlist is simplest for one admin.

### External / owner actions (I can't do these from here)
5. **Run the outstanding SQL** (A4) in Supabase if not already applied (last_seen_at,
   portal_read_receipts, message_retention_days). Then run the new migrations from B-items as
   they land.
6. **Set Vercel env vars:**
   - `CRON_SECRET` (A7) — turns on message retention.
   - `PORTAL_JWT_SECRET` — confirm prod has a real value (placeholder still in `.env.local`).
   - Cloudinary signing already has `CLOUDINARY_API_SECRET` locally — confirm it's set in prod
     for signed uploads (A3).
   - `RESEND_API_KEY` + `EMAIL_WEBHOOK_SECRET` — confirm set (feedback email B2 needs Resend).
   - `ADMIN_EMAILS` (B1, if we go env-allowlist).
   - New AV provider key (B5) once chosen.
7. **DNS / subdomain:** confirm `admin.theruff.agency` resolves under the existing wildcard
   `*.theruff.agency` on Vercel so the admin board (B1) can be served there.
8. **Supabase redirect URL:** `https://*.theruff.agency/auth/callback` for owner Google login on
   subdomains (already noted in HANDOVER; confirm it's added).
9. **Cloudflare (B6):** confirm you're happy with **Vercel-native** protection (free) and we are
   NOT fronting with Cloudflare. If you specifically want Cloudflare, say so — it changes DNS and
   the subdomain setup and I'll plan it separately.
10. **PostHog (B1, later phase):** when ready, confirm a PostHog project + the cookie-consent
    requirement (CLAUDE.md: PostHog must not load before consent). Out of scope for this round.

---

## Suggested execution order
A1 → A2 → A3 → A4 → A5 → A6 → A7 → B2 → B1 → B4 → B3 → B6 → B5 → (C-items as capacity allows)

(B2/B1 early so you can start collecting feedback + watching metrics while testing; B5 last as it
depends on a Part D decision; B3 Projects is the largest single item.)
