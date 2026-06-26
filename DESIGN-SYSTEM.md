# Fey — Design System

The brand and UI conventions for **Fey** (a freelancer/agency CRM). This is the
source of truth for any design or UI work. Everything here is pulled from the
live codebase (`src/app/globals.css`, `src/components/ui/*`). Follow it so new
work stays on-brand and consistent.

Stack: **Next.js 16 (App Router) · Tailwind CSS v4 · TypeScript · shadcn-style primitives**.

---

## 1. Brand at a glance

- **Accent / primary:** `#ED64A6` (Fey pink). The single brand colour — used for primary buttons, active states, links, focus accents, and key highlights. Use it deliberately, not everywhere.
- **Voice of the UI:** calm, light, uncluttered. Lots of whitespace, soft borders, gentle motion. Never loud.
- **Surfaces:** white cards on a soft grey page (`#F7F8FA`).
- **Type:** NoirPro, light weight. Headings are only *slightly* heavier than body.

---

## 2. Colour

### Brand + semantic (from `@theme` in `globals.css`)

| Token | Hex | Use |
|---|---|---|
| `--color-primary` / `--accent` | `#ED64A6` | Primary actions, active nav, links, focus, key accents |
| `--color-success` | `#48BB78` | Success, completed, positive status |
| `--color-pending` | `#F6AD55` | Pending / in-progress / warning |
| `--color-danger` | `#FC8181` | Errors, destructive, overdue |
| `--color-appbg` | `#F7F8FA` | App page background |

### Neutrals (Tailwind grey scale — the everyday palette)

- **Page background:** `bg-[#F7F8FA]` (or `bg-appbg`)
- **Card / surface:** `bg-white`
- **Borders:** `border-gray-100` (default hairline), `border-gray-200` (slightly stronger)
- **Body text:** `text-gray-800` / `text-gray-700`
- **Muted text:** `text-gray-400` (captions, hints, metadata)
- **Headings:** `text-gray-800`/`text-gray-900`

> **Tinted accent backgrounds:** for soft accent fills use the accent at low opacity, e.g. `style={{ backgroundColor: '#ED64A615' }}` with `color: '#ED64A6'` text. This is the house pattern for active pills, soft badges, and selected states.

### Status colour pairing (badges / pills)

| Status | Background | Text |
|---|---|---|
| Active / accent | `#ED64A618` | `#ED64A6` |
| Completed / success | `#ECFDF5` | `#059669` |
| Pending | `#FFFAF0` | `#C05621` |
| Neutral / idle | `#F3F4F6` | `#9CA3AF` |

---

## 3. Typography

**Font:** `NoirPro` (var `--font-sans` / `--font-display`), loaded from `/fonts/NoirPro-*.otf`.
NoirPro ships **only two weights**: Light (300) and Regular (400).

- **Body text:** weight **300** (light). This is the default everywhere.
- **Headings & emphasis:** weight **400** (regular) + `letter-spacing: -0.02em`. Use `font-display` or `h1/h2/h3`. **Never go heavier than 400** — there is no bold face; faux-bold is disabled (`font-synthesis: none`).
- Apply `.font-display` for display headings (e.g. big numbers, page titles).

### Type scale (Tailwind + custom)

Standard: `text-xs` 12 · `text-sm` 14 · `text-base` 16 · `text-lg` 18 · `text-xl` 20.

Custom micro/in-between sizes (use these instead of `text-[Npx]`):

| Class | Size |
|---|---|
| `text-sm2` | 15px |
| `text-xs2` | 13px |
| `text-2xs` | 11px |
| `text-3xs` | 10px |
| `text-4xs` | 9px |
| `text-5xs` | 8px |

Use `tabular-nums` for numbers in stats/counters so they don't jitter.

---

## 4. Corner radius

Base token: **`--radius: 0.5rem` (8px)**. The scale is derived from it:

| Class | Multiplier | ~Value |
|---|---|---|
| `rounded-sm` | ×0.6 | ~5px |
| `rounded-md` | ×0.8 | ~6px |
| `rounded-lg` | ×1.0 | 8px |
| `rounded-xl` | ×1.4 | ~11px |
| `rounded-2xl` | ×1.8 | ~14px |
| `rounded-3xl` | ×2.2 | ~18px |
| `rounded-4xl` | ×2.6 | ~21px |

**House conventions:**
- **Cards / panels:** `rounded-2xl`
- **Buttons / inputs:** `rounded-lg` or `rounded-xl`
- **Pills / badges / chips:** fully rounded (`rounded-full` / `rounded-4xl`)
- **Avatars, dots:** `rounded-full`

---

## 5. Spacing, shadows, motion

- **Page padding:** `p-4 md:p-6 lg:p-8`.
- **Card padding:** `p-6` (standard), `p-4` (compact tiles).
- **Gaps:** `gap-2`/`gap-3` inside rows, `gap-4` between cards.
- **Tap targets:** minimum **44×44px** for interactive controls (accessibility).

**Shadows** (subtle — restored Tailwind v3 scale): `shadow-sm` for cards (default), `shadow-md`/`shadow-lg` for popovers/modals. Cards are typically `border border-gray-100 shadow-sm`, not heavy shadows.

**Motion** — quick and gentle (named animations in `globals.css`):
- `animate-fadeIn` (200ms), `animate-slideUp` (200ms), `animate-slideDown` (150ms), `animate-scale-in` (200ms), `page-enter` (page mount).
- Framer Motion is available via `@/components/ui/motion` (`<Stagger>`, `<StaggerItem>`, `<FadeIn>`) for list/section reveals; reduced-motion is honoured globally.
- Keep transitions ~150–200ms, `ease`. Never bouncy or slow.

---

## 6. Component conventions

The primitives live in `src/components/ui/` (shadcn-style, `cva` variants, `cn()` for class merging). Read those files for exact APIs. Key patterns:

### Card (the workhorse surface)
```tsx
<div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">…</div>
```
Header row: small lucide icon (`size={14}` `text-gray-400`) + `text-sm font-semibold text-gray-800` title, optional action link on the right in accent.

### Button (`@/components/ui/button`)
Variants: `default` (accent-filled), `outline`, `secondary`, `ghost`, `destructive`, `link`. Sizes: `xs`/`sm`/`default`/`lg` + icon sizes. Primary CTA = `default`; secondary = `outline`/`ghost`. **One primary button per view.**

A common inline CTA pattern:
```tsx
<Link className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold text-white"
  style={{ backgroundColor: '#ED64A6' }}>…</Link>
```

### Badge / pill (`@/components/ui/badge`)
Small, `rounded-4xl`, `text-xs font-medium`. Use the status colour pairings in §2.

### Checkbox (`@/components/ui/checkbox`)
Accent-filled when checked (pink box, white check), grey border when unchecked. Supports `checked` / `indeterminate` / `disabled` / `label`.

### Data-fetching components — always handle three states
1. **Loading** — skeleton (`@/components/ui/skeleton`) or spinner, not a blank screen.
2. **Empty** — a meaningful message + an action (e.g. "No clients yet · Add first client"), never a blank box.
3. **Error** — plain-English message with a retry where sensible (no codes, no "something went wrong").

### Loaders
Use `BrandLoader` for branded loading; `Skeleton` for content placeholders.

---

## 7. Banned patterns (do not use, ever)

- **Status badge / availability pill / live-indicator chip** — the rounded pill with a pulsing green dot and a short label (e.g. "Open to work", "Available"). Do not build or suggest it.
- **Faux-bold text** — no weight above 400 (NoirPro has no bold face).
- **Heavy drop shadows, gradients, glows** — keep surfaces flat and soft.
- **Inline `text-[Npx]` magic numbers** — use the type scale tokens (§3).
- **Title Case or ALL CAPS in UI copy** — use sentence case. Plain-English, no jargon, no error codes shown to users.

---

## 8. Quick reference snippet

A representative on-brand card, using real tokens:

```tsx
<div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
  <div className="flex items-center justify-between mb-4">
    <div className="flex items-center gap-2">
      <Users size={14} className="text-gray-400" />
      <p className="text-sm font-semibold text-gray-800">Clients</p>
    </div>
    <span className="text-3xs font-medium px-2 py-0.5 rounded-full"
          style={{ backgroundColor: '#ED64A618', color: '#ED64A6' }}>
      Active
    </span>
  </div>
  <p className="font-display text-4xl font-normal text-gray-900 tabular-nums">128</p>
  <p className="text-xs text-gray-400 mt-1.5">total clients</p>
</div>
```

---

*Generated from the Fey codebase. When tokens or conventions change in
`src/app/globals.css` or `src/components/ui/*`, update this file to match.*
