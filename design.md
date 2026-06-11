# Fey Design System

A living reference for every visual and structural decision in the codebase. Keep this updated as the UI evolves.

---

## Table of Contents

1. [Design Tokens](#1-design-tokens)
2. [Typography](#2-typography)
3. [Color System](#3-color-system)
4. [Spacing & Layout](#4-spacing--layout)
5. [Component Patterns](#5-component-patterns)
6. [Page Layouts](#6-page-layouts)
7. [Animation & Motion](#7-animation--motion)
8. [Icon Library](#8-icon-library)
9. [Screen Inventory](#9-screen-inventory)
10. [Design Principles](#10-design-principles)

---

## 1. Design Tokens

### CSS Variables

Defined in `src/app/globals.css` via Tailwind v4's `@theme` block and `:root`.

| Variable | Default Value | Usage |
|---|---|---|
| `--accent` | `#ED64A6` | Primary brand color — buttons, active nav, progress rings. User-overridable via Settings. |
| `--body-font` | `'NoirPro', sans-serif` | Body text |
| `--heading-font` | `'NoirPro', sans-serif` | Headings and display text |

### Tailwind Theme (`@theme` in `globals.css`)

| Token | Value | Notes |
|---|---|---|
| `primary` | `#ED64A6` | Matches default `--accent` |
| `success` | `#48BB78` | Green — paid, complete |
| `pending` | `#F6AD55` | Amber — warnings, overdue |
| `danger` | `#FC8181` | Red — errors, delete actions |
| `appbg` | `#F7F8FA` | Page background |

> **Note:** Tailwind v4 has no `tailwind.config.ts`. All tokens live in `globals.css`.

### Accent Color Palette

User-selectable from Settings → Branding:

```
#ED64A6  #F56565  #ED8936  #38B2AC
#9F7AEA  #667EEA  #48BB78  #4299E1
```

Accent is applied as:
- **Solid:** `style={{ backgroundColor: 'var(--accent)' }}` — primary buttons
- **Tinted:** `style={{ backgroundColor: \`${accent}15\` }}` — active nav backgrounds (8% opacity)
- **Text:** `style={{ color: accent }}` — active nav icons, links

---

## 2. Typography

### Font Family

**NoirPro** is the sole typeface. Loaded via `@font-face` in `globals.css`:

| Weight | Class | Use |
|---|---|---|
| 300 | `font-light` | Large display, rarely used |
| 400 | (default body) | Body copy |
| 500 | `font-medium` | Secondary emphasis |
| 600 | `font-semibold` | Page titles, labels, sub-headings |
| 700 | `font-bold` | Stat numbers, modal headers |

### Type Scale

| Class | Size | Where used |
|---|---|---|
| `text-[10px]` | 10px | Invoice "FROM" / "BILL TO" labels |
| `text-xs` / `text-[13px]` | 12–13px | Captions, timestamps, secondary row text |
| `text-sm` / `text-[15px]` | 14–15px | Primary body text, table cells, row titles |
| `text-base` | 16px | Section headings, month labels in payments |
| `text-lg` | 18px | Modal titles |
| `text-xl` | 20px | Dashboard heading |
| `text-2xl` | 24px | **Page h1 titles** (all pages), stat card numbers |

### Conventions

| Element | Class |
|---|---|
| Page `<h1>` | `text-2xl font-semibold text-gray-900` |
| Dashboard heading | `text-[20px] font-normal text-gray-700` |
| Section heading | `text-xs font-semibold text-gray-400 uppercase tracking-wide` |
| List row title | `text-[15px] font-medium text-gray-900` |
| List row subtitle | `text-[13px] text-gray-400` |
| Body | `text-sm text-gray-700` |
| Muted | `text-sm text-gray-400` |

---

## 3. Color System

### Neutrals (Most-used)

| Class | Hex | Role |
|---|---|---|
| `gray-50` | `#F9FAFB` | Hover backgrounds, input fills |
| `gray-100` | `#F3F4F6` | Borders, dividers, chip backgrounds |
| `gray-200` | `#E5E7EB` | Form field borders |
| `gray-400` | `#9CA3AF` | Placeholder text, muted icons |
| `gray-500` | `#6B7280` | Secondary text |
| `gray-700` | `#374151` | Primary body text |
| `gray-900` | `#111827` | Page titles, strong headings |

### Status Colors

| Status | Background | Text |
|---|---|---|
| Active | `bg-emerald-50` | `text-emerald-600` |
| Completed | `bg-blue-50` | `text-blue-500` |
| Idle | `bg-gray-100` | `text-gray-400` |
| Paid | `text-success` (green) | — |
| Pending payment | `text-amber-500` | — |
| Draft | `bg-gray-100` | `text-gray-600` |
| Sent | `bg-blue-100` | `text-blue-700` |
| Overdue | `bg-red-100` | `text-red-700` |

### Client Avatar Colors

| Card BG | Text |
|---|---|
| `#FDE8E8` | `#92400E` |
| `#FEF3C7` | `#78350F` |
| `#D1FAE5` | `#065F46` |
| `#DBEAFE` | `#1E3A8A` |
| `#EDE9FE` | `#5B21B6` |
| `#FCE7F3` | `#9D174D` |

### Surfaces

| Surface | Color |
|---|---|
| App background | `bg-appbg` / `#F7F8FA` |
| Card / Panel | `bg-white` |
| Input fill | `bg-gray-50` |
| Modal overlay | `rgba(0,0,0,0.4)` |

---

## 4. Spacing & Layout

### Core Shell

```
App
├── Sidebar (desktop: fixed left, w-[72px])
│   ├── Logo avatar
│   ├── Nav items (gap-2)
│   └── Settings (bottom, border-t)
├── Bottom nav (mobile only, fixed bottom-0)
└── Main content (flex-1, ml-0 lg:ml-[72px], pb-16 lg:pb-0)
```

### Page Padding

| Context | Class |
|---|---|
| Page content wrapper | `p-4 lg:p-6` |
| Modal inner | `p-6` |
| Card inner | `p-4` or `p-5` |
| Sidebar nav items | `px-4 py-3` |

### Border Radius

| Class | Used for |
|---|---|
| `rounded-md` | Small avatars in list rows (`w-6 h-6`) |
| `rounded-xl` | Inputs, secondary buttons, nav items, form fields |
| `rounded-2xl` | Cards, panels, modals, list containers |
| `rounded-full` | **Primary action buttons**, badges, pills, avatar circles |

### Shadows

| Class | Used for |
|---|---|
| `shadow-sm` | Default card elevation |
| `shadow-md` | Hover state, dropdowns |
| `shadow-xl` | Large modals |
| `shadow-2xl` | Overlay popups |

---

## 5. Component Patterns

### Buttons

**Primary (accent-filled, `rounded-full`)**
```jsx
<button
  className="px-5 py-2.5 rounded-full text-sm font-semibold text-white transition-opacity disabled:opacity-40"
  style={{ backgroundColor: 'var(--accent)' }}
>
  + Add
</button>
```

**Secondary (outlined)**
```jsx
<button className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
  Cancel
</button>
```

**Icon button**
```jsx
<button className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 transition-colors">
  <Icon size={18} />
</button>
```

**Danger**
```jsx
<button className="px-4 py-2 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition-colors">
  Delete
</button>
```

> **Rule:** Primary CTA buttons always `rounded-full`. Secondary/utility buttons `rounded-xl`.

### List Rows (Clients, Payments)

```jsx
<div className="group flex items-center gap-3 h-12 px-4 bg-white border-b border-gray-100 last:border-b-0 hover:bg-gray-50/70 transition-colors cursor-pointer">
  {/* 32px avatar */}
  <div
    className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-semibold"
    style={{ backgroundColor: client.color }}
  >
    {client.name.charAt(0)}
  </div>
  {/* Name */}
  <span className="flex-1 text-[15px] font-medium text-gray-900 truncate">{client.name}</span>
  {/* Status badge */}
  <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">
    Active
  </span>
  {/* Progress bar */}
  <div className="w-16 h-1 rounded-full bg-gray-100 overflow-hidden">
    <div className="h-full rounded-full bg-emerald-400" style={{ width: `${pct}%` }} />
  </div>
</div>
```

List container:
```jsx
<div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
  {/* rows */}
</div>
```

### Empty States

Consistent pattern used on all pages:

```jsx
<div className="flex flex-col items-center justify-center py-20 text-center">
  <Icon size={32} className="text-gray-300 mb-3" />
  <p className="text-[15px] font-medium text-gray-500 mb-1">Nothing here yet</p>
  <p className="text-[13px] text-gray-400 mb-5">Context-specific helper message</p>
  <button
    className="px-5 py-2 rounded-full text-sm font-semibold text-white"
    style={{ backgroundColor: 'var(--accent)' }}
  >
    + Action
  </button>
</div>
```

### Cards

**Standard**
```jsx
<div className="bg-white rounded-2xl shadow-sm p-5">{/* content */}</div>
```

**Hoverable**
```jsx
<div className="bg-white rounded-2xl shadow-sm p-5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 cursor-pointer">
```

**Stat card**
```jsx
<div className="bg-white rounded-2xl shadow-sm p-5 flex items-center gap-4">
  <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-violet-100">
    <Icon size={18} className="text-violet-600" />
  </div>
  <div>
    <p className="text-xs text-gray-400 mb-0.5">Label</p>
    <p className="text-2xl font-bold text-gray-900">42</p>
  </div>
</div>
```

### Modals

```jsx
<div
  className="fixed inset-0 z-50 flex items-center justify-center p-4"
  style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
>
  <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden">
    {/* Header */}
    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
      <h2 className="text-lg font-bold text-gray-900">Title</h2>
      <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400">
        <X size={18} />
      </button>
    </div>
    {/* Scrollable body */}
    <div className="flex-1 overflow-y-auto px-6 py-5">{/* body */}</div>
    {/* Footer CTA */}
    <div className="px-6 pb-5 pt-3 border-t border-gray-100 flex-shrink-0">
      <button
        className="w-full py-3 rounded-full text-sm font-semibold text-white"
        style={{ backgroundColor: 'var(--accent)' }}
      >
        Confirm
      </button>
    </div>
  </div>
</div>
```

### Toggle Switch

```jsx
<button
  onClick={toggle}
  className="relative w-10 h-6 rounded-full transition-colors flex-shrink-0"
  style={{ backgroundColor: isOn ? 'var(--accent)' : '#D1D5DB' }}
>
  <span
    className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform"
    style={{ left: isOn ? '18px' : '2px' }}
  />
</button>
```

### Form Inputs

```jsx
<input className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-800 focus:outline-none focus:border-gray-400 focus:bg-white transition-colors" />
```

### Progress Ring (SVG)

```jsx
{/* r=18, circumference ≈ 113 */}
<svg viewBox="0 0 40 40">
  <circle cx="20" cy="20" r="18" fill="none" stroke="#F3F4F6" strokeWidth="3" />
  <circle
    cx="20" cy="20" r="18" fill="none"
    stroke={accent} strokeWidth="3"
    strokeDasharray={`${pct * 113} 113`}
    strokeLinecap="round"
    transform="rotate(-90 20 20)"
    style={{ transition: 'stroke-dasharray 0.5s ease' }}
  />
</svg>
```

### Nav Item (Sidebar)

- **Active:** tinted accent background (`${accent}15`) + accent icon color
- **Inactive:** `text-gray-400`, hover `text-gray-700 bg-gray-50`
- **Subtle variant** (Fey nav item): adds `opacity-70` when inactive, `opacity-100` on hover

---

## 6. Page Layouts

### Standard App Page

```
┌─────────────────────────────────────────┐
│ Sidebar (72px, fixed) │  Main           │
│                       │  p-4 lg:p-6     │
│  Logo avatar          │                 │
│  Nav items            │  h1 (24px/600)  │
│  ...                  │  <content>      │
│  Settings             │                 │
└─────────────────────────────────────────┘
```

### Dashboard (Two-column)

```
Main
├── Left (flex-1): Heading + filter pills + client task list
└── Right (w-72): Activity chart + "This Month" stat card only
```

### Clients / Payments (List)

```
Main
├── Toolbar: search + sort + grid/list toggle + Add button (rounded-full)
└── Content: bg-white rounded-2xl list container with h-12 rows
```

### Invoice Builder

```
Main (full viewport)
├── Top toolbar (sticky)
├── Body: flex
│   ├── Document area (flex-1, inline-editable)
│   └── Settings panel (lg:w-[240px])
```

### Settings

```
Main
├── Left nav (lg:w-[200px], sticky): tab items
└── Right (flex-1): SectionGroups stacked vertically
```

---

## 7. Animation & Motion

### Keyframes (in `globals.css`)

| Name | Effect | Duration |
|---|---|---|
| `fadeIn` | opacity + translateY 4px→0 | 200ms ease |
| `slideDown` | opacity + translateY -8px→0 | 150ms ease |
| `slideUp` | opacity + translateY 12px→0 | 200ms ease |
| `scaleIn` | opacity + scale 0.92→1 | 200ms ease |
| `scaleOut` | opacity + scale 1→0.92 | 200ms ease |
| `scaleBounce` | scale 1→1.2→1 | 200ms ease |
| `shake` | translateX ±4px oscillation | 200ms ease |
| `fadeOut` | opacity 1→0 + translateY -4px | 200ms ease forwards |
| `slowRotate` | 0→360deg | 8s infinite ease-in-out |
| `pageEnter` | opacity 0→1 | 200ms ease |

### Timing Rules

| Interaction | Duration |
|---|---|
| Button / nav hover | `transition-all duration-150` |
| Modal enter / exit | 200ms |
| Card hover lift | `hover:-translate-y-0.5 hover:shadow-md transition-all duration-150` |
| Progress ring fill | `transition: stroke-dasharray 0.5s ease` |
| Decorative / ambient | 300ms–8s |

---

## 8. Icon Library

All icons from **`lucide-react`**.

| Category | Icons |
|---|---|
| Navigation | `LayoutDashboard`, `Users`, `ListTodo`, `FileText`, `Settings`, `CreditCard`, `Sparkles` |
| Actions | `Plus`, `Trash2`, `Edit3`, `Check`, `X`, `Copy`, `Upload` |
| Status | `CheckCircle2`, `AlertTriangle`, `AlertCircle`, `Info` |
| Direction | `ChevronDown`, `ChevronUp`, `ChevronLeft`, `ChevronRight`, `ArrowRight` |
| Data | `TrendingUp`, `LayoutGrid`, `List`, `BarChart2` |
| Async | `Loader2`, `RefreshCw` |
| Empty states | `Users`, `TrendingUp`, `ListTodo`, `FileText`, `Inbox` |

**Size conventions:**

| Context | Size |
|---|---|
| Sidebar nav (desktop) | `size={20}` |
| Sidebar nav (mobile) | `size={22}` |
| Button icons | `size={16}` |
| Stat card icons | `size={18}` |
| Close / utility | `size={18}` |
| Empty state | `size={32}` |

---

## 9. Screen Inventory

| Page | Route | Description |
|---|---|---|
| **Dashboard** | `/` | Heading, filter pills, client task list, right panel: activity chart + This Month card |
| **Clients** | `/clients` | List view (default) / grid toggle. h-12 rows with avatar, status badge, progress bar. |
| **Client Workspace** | `/clients/:id` | Tasks, Retainer, Files, Notes tabs |
| **Campaign** | `/clients/:id/campaigns/:id` | Campaign task board |
| **Tasks** | `/tasks` | Task groups with SVG rings, standalone tasks |
| **Task Workspace** | `/tasks/:id` | Single group detail |
| **Payments** | `/payments` | Month accordion → client groupings → task rows. Green=paid, amber=pending. |
| **Invoices** | `/invoices` | Table with stat cards |
| **Invoice Builder** | `/invoices/new` `/invoices/:id` | Inline-editable doc + settings panel |
| **Fey** | `/fey` | AI/WhatsApp-extracted task view |
| **Settings** | `/settings` | 8-tab settings panel |
| **Login** | `/login` | Email/password + Google OAuth |
| **Public Invoice** | `/invoice/:token` | Token-gated read-only invoice |
| **Shared Client** | `/share/:token` | Public client workspace view |

---

## 10. Design Principles

### Visual Language

- **Clean and minimal** — white surfaces, `#F7F8FA` background, generous space. Let content breathe.
- **Hierarchy through weight** — importance via font weight and size, not decoration.
- **Color is intentional** — accent = interactive, status colors = meaning, gray = neutral.

### Interaction Model

- **150ms for interactions** — buttons, nav, inputs.
- **200ms for transitions** — modals, panels, content shifts.
- **Disabled = `opacity-40`** — never hidden or restructured, layout stays stable.
- **Hover lift on cards** — `hover:-translate-y-0.5 hover:shadow-md`.

### Consistency Rules

| Element | Radius |
|---|---|
| Primary buttons, pills, avatar circles | `rounded-full` |
| Inputs, secondary buttons, nav items | `rounded-xl` |
| Cards, panels, modals, list containers | `rounded-2xl` |
| Small client-group avatars | `rounded-md` |

### Banned Patterns

- **No status badge pills with pulsing dots** — (e.g. "Open to work" availability chips)
- **No hardcoded `#ED64A6`** in components — always `var(--accent)` or the `accent` prop
- **No inline `style={{ margin/padding }}`** — Tailwind classes only
- **No `console.log`** in production code
- **No `any` types** — use `unknown` and narrow

### Theming

- `--accent` is user-controlled (Settings → Branding)
- Logo, company name, currency all flow from `settings` context
- Never hardcode brand values in components

### Accessibility

- `gray-500+` for all meaningful text (`gray-400` is the floor for decorative/secondary)
- 44px min touch targets on mobile
- `disabled:opacity-40` on all interactive elements
- Semantic HTML — `<button>` for actions, `<a>` for navigation

---

*Last updated: 2026-06-10*
