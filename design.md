# WorkBoard Design System

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

Defined in `src/index.css` and consumed throughout the app via `var(...)`.

| Variable | Default Value | Usage |
|---|---|---|
| `--accent` | `#ED64A6` | Primary brand color — buttons, active nav, progress rings, badges. User-overridable via Settings. |
| `--body-font` | `'NoirPro', sans-serif` | Body text |
| `--heading-font` | `'NoirPro', sans-serif` | Headings and display text |
| `--appbg` | `#F7F8FA` | App page background |

### Tailwind Theme Extensions (`tailwind.config.js`)

| Token | Value | Notes |
|---|---|---|
| `primary` | `#ED64A6` | Matches default `--accent` |
| `success` | `#48BB78` | Green — paid, complete |
| `pending` | `#F6AD55` | Amber — warnings, overdue |
| `danger` | `#FC8181` | Red — errors, delete actions |
| `appbg` | `#F7F8FA` | Page background shorthand |

### Accent Color Palette

The user can choose their accent from this preset list in Settings → Branding:

```
#ED64A6  #F56565  #ED8936  #38B2AC
#9F7AEA  #667EEA  #48BB78  #4299E1
```

Accent is applied as:
- **Solid:** `backgroundColor: accent` — primary buttons, active indicators
- **Tinted:** `backgroundColor: \`${accent}15\`` — active nav item backgrounds (8% opacity)
- **Text:** `color: accent` — active nav icons, links, highlights

---

## 2. Typography

### Font Family

**NoirPro** is the sole typeface. Weights loaded via `@font-face` in `src/index.css`:

| Weight | Class | Use |
|---|---|---|
| 300 | `font-light` | Rarely used, large display text |
| 400 | (default) | Body copy |
| 500 | `font-medium` | Secondary emphasis |
| 600 | `font-semibold` | Buttons, field labels, sub-headings |
| 700 | `font-bold` | Page titles, stat numbers, modal headers |

Display text uses `font-display` (maps to `--heading-font`) with `letter-spacing: -0.02em`.

### Type Scale

| Class | Size | Where used |
|---|---|---|
| `text-[10px]` | 10px | Fine print, "FROM" / "BILL TO" labels in invoices |
| `text-xs` | 12px | Captions, section labels, badge text, timestamps |
| `text-sm` | 14px | Primary body text, table cells, form inputs |
| `text-base` | 16px | Standard paragraphs |
| `text-lg` | 18px | Modal titles, section headings |
| `text-xl` | 20px | Page headings |
| `text-2xl` | 24px | Stat card numbers, dashboard totals |

### Conventions

- Page-level `<h1>` equivalents: `font-display text-xl font-bold text-gray-900`
- Section headings: `text-xs font-semibold text-gray-400 uppercase tracking-wide`
- Body: `text-sm text-gray-700`
- Secondary/muted: `text-sm text-gray-400` or `text-xs text-gray-400`
- Monospace numbers: Use default font (NoirPro) — no mono class on prices/totals

---

## 3. Color System

### Neutrals (Most-used)

| Tailwind Class | Hex | Role |
|---|---|---|
| `gray-50` | `#F9FAFB` | Hover backgrounds, input fills, section alternates |
| `gray-100` | `#F3F4F6` | Borders, dividers, chip backgrounds |
| `gray-200` | `#E5E7EB` | Strong borders, form field borders |
| `gray-300` | `#D1D5DB` | Placeholder icons, disabled borders |
| `gray-400` | `#9CA3AF` | Placeholder text, muted icons |
| `gray-500` | `#6B7280` | Secondary text, inactive labels |
| `gray-600` | `#4B5563` | Body text |
| `gray-700` | `#374151` | Primary body text |
| `gray-800` | `#1F2937` | Headings |
| `gray-900` | `#111827` | Page titles, logo background |

### Status Colors

| Status | Background | Text | Used for |
|---|---|---|---|
| Draft | `bg-gray-100` | `text-gray-600` | Unsent invoices, unpublished |
| Sent / Info | `bg-blue-100` | `text-blue-700` | Sent invoices, info badges |
| Paid / Success | `bg-green-100` | `text-green-700` | Paid invoices, completed tasks |
| Overdue / Warning | `bg-red-100` | `text-red-700` | Overdue, error states |
| Pending / Caution | `bg-amber-100` | `text-amber-700` | Warnings, pending actions |
| Cancelled | `bg-gray-100` | `text-gray-500` | Voided, cancelled items |

### Client Card Colors

Client cards get assigned a background color with a computed contrasting text color:

| Card BG | Text Color |
|---|---|
| `#FDE8E8` (light pink) | `#92400E` |
| `#FEF3C7` (light yellow) | `#78350F` |
| `#D1FAE5` (light green) | `#065F46` |
| `#DBEAFE` (light blue) | `#1E3A8A` |
| `#EDE9FE` (light purple) | `#5B21B6` |
| `#FCE7F3` (light rose) | `#9D174D` |

### Page / Surface Colors

| Surface | Color |
|---|---|
| App background | `bg-appbg` / `#F7F8FA` |
| Card / Panel | `bg-white` |
| Input fill | `bg-gray-50` |
| Modal overlay | `rgba(0,0,0,0.4)` |
| Toast background | `bg-gray-800` (dark) |

---

## 4. Spacing & Layout

### Core Shell

```
App
├── Sidebar (desktop: fixed left, w-[72px])
│   ├── Logo
│   ├── Nav items (gap-2)
│   └── Settings + badge (bottom, border-t)
├── Bottom nav (mobile only, fixed bottom-0)
└── Main content (flex-1, ml-0 lg:ml-[72px], pb-16 lg:pb-0)
```

### Page Padding

| Context | Class |
|---|---|
| Page content wrapper | `p-4 lg:p-6` |
| Modal inner | `p-6` |
| Card inner | `p-4` or `p-5` |
| Section group inner | `px-5 py-4` |
| Sidebar nav items | `px-4 py-3` |
| Table cells | `px-4 py-3` |

### Gap Scale

| Use | Class |
|---|---|
| Inline icon + label | `gap-1.5` |
| Form fields | `gap-3` |
| Card grids | `gap-4` |
| Page sections | `gap-6` |

### Border Radius

| Class | Pixels | Used for |
|---|---|---|
| `rounded-sm` | 2px | Rarely used |
| `rounded` | 4px | Checkboxes, tiny elements |
| `rounded-md` | 6px | Small chips |
| `rounded-lg` | 8px | Tabs, secondary buttons |
| `rounded-xl` | 12px | Buttons, inputs, nav items, form fields |
| `rounded-2xl` | 16px | Cards, panels, modals |
| `rounded-full` | 9999px | Badges, pills, avatar circles, progress rings |

### Shadows

| Class | Used for |
|---|---|
| `shadow-sm` | Default card elevation |
| `shadow-md` | Card hover state, dropdowns |
| `shadow-lg` | Dragging cards, sticky elements |
| `shadow-xl` | Large modals |
| `shadow-2xl` | Overlay popups, maximum depth |

### Max Widths

| Class | Used for |
|---|---|
| `max-w-xs` | Small sidebar panels |
| `max-w-sm` | Toast notifications |
| `max-w-md` | Auth forms, small modals |
| `max-w-lg` | Standard modals (NewInvoiceModal) |
| `max-w-2xl` | Settings content area |
| `max-w-3xl` | Invoice document, public pages |

### Responsive Breakpoints (Tailwind defaults)

| Prefix | Width | Notes |
|---|---|---|
| _(none)_ | 0px+ | Mobile-first baseline |
| `sm:` | 640px+ | Small tablets |
| `md:` | 768px+ | Tablet landscape |
| `lg:` | 1024px+ | Desktop — sidebar appears, bottom nav hides |
| `xl:` | 1280px+ | Wide desktop |

---

## 5. Component Patterns

### Buttons

**Primary (accent-filled)**
```jsx
<button className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-40"
  style={{ backgroundColor: 'var(--accent)' }}>
  Label
</button>
```

**Secondary (outlined / ghost)**
```jsx
<button className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
  Label
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

**Disabled state:** Always `disabled:opacity-40` — never hide or change layout.

### Cards

**Standard card**
```jsx
<div className="bg-white rounded-2xl shadow-sm p-5">
  {/* content */}
</div>
```

**Hoverable card**
```jsx
<div className="bg-white rounded-2xl shadow-sm p-5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 cursor-pointer">
  {/* content */}
</div>
```

**Card with accent stripe**
```jsx
<div className="relative bg-white rounded-2xl shadow-sm p-5">
  <div className="absolute top-0 left-0 right-0 h-1.5 rounded-t-2xl" style={{ backgroundColor: accent }} />
  {/* content */}
</div>
```

### Modals

Structure is always:
```jsx
{/* Overlay */}
<div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
  {/* Sheet */}
  <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden">
    {/* Header */}
    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
      <h2 className="font-display text-lg font-bold text-gray-900">Title</h2>
      <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400">
        <X size={18} />
      </button>
    </div>
    {/* Scrollable body */}
    <div className="flex-1 overflow-y-auto px-6 py-5">
      {/* content */}
    </div>
    {/* Footer CTA */}
    <div className="px-6 pb-5 pt-3 border-t border-gray-100 flex-shrink-0">
      <button className="w-full py-3 rounded-xl text-sm font-semibold text-white" style={{ backgroundColor: 'var(--accent)' }}>
        Confirm
      </button>
    </div>
  </div>
</div>
```

### Inline Editable Fields (iField)

Used inside the invoice builder — inputs that look like plain text until interacted with:

```js
const iField = 'w-full bg-transparent border border-transparent rounded px-1 py-0.5 outline-none hover:border-gray-200 focus:border-gray-300 focus:bg-white/80 transition-all text-inherit'
```

### Form Inputs (Settings / Forms)

```jsx
<input className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-800 focus:outline-none focus:border-gray-400 focus:bg-white transition-colors" />
```

```jsx
<textarea className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-800 focus:outline-none focus:border-gray-400 resize-none" />
```

### Badges / Pills

**Status badge**
```jsx
<span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-green-100 text-green-700 capitalize">
  Paid
</span>
```

**Count badge (on nav icons)**
```jsx
<span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-white text-[10px] font-bold flex items-center justify-center"
  style={{ backgroundColor: 'var(--accent)' }}>
  3
</span>
```

### Toggle Switch (iOS-style)

```jsx
<button
  onClick={toggle}
  className="relative w-10 h-6 rounded-full transition-colors flex-shrink-0"
  style={{ backgroundColor: isOn ? 'var(--accent)' : '#D1D5DB' }}
>
  <span className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform"
    style={{ left: isOn ? '18px' : '2px' }} />
</button>
```

### NavLink (Sidebar)

```jsx
const navLinkClass = ({ isActive }) =>
  `w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-150 ${
    isActive ? '' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-50'
  }`;

const navLinkStyle = ({ isActive }) =>
  isActive ? { backgroundColor: `${accent}15`, color: accent } : {};
```

### Section Group (Settings rows)

```jsx
<div className="bg-white rounded-2xl shadow-sm overflow-hidden">
  <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-4">
    {/* icon */}
    <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
      <Icon size={16} className="text-gray-500" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-semibold text-gray-800">Setting Name</p>
      <p className="text-xs text-gray-400">Description of what this does</p>
    </div>
    {/* action widget: Toggle, input, button, etc */}
  </div>
</div>
```

### Progress Ring (SVG)

Used on task completion cards:

```jsx
// r=18, cx=cy=20, circumference = 2π×18 ≈ 113
<svg viewBox="0 0 40 40">
  <circle cx="20" cy="20" r="18" fill="none" stroke="#F3F4F6" strokeWidth="3" />
  <circle cx="20" cy="20" r="18" fill="none"
    stroke={accent} strokeWidth="3"
    strokeDasharray={`${pct * 113} 113`}
    strokeLinecap="round"
    transform="rotate(-90 20 20)"
    style={{ transition: 'stroke-dasharray 0.5s ease' }}
  />
</svg>
```

### Stat Cards

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

---

## 6. Page Layouts

### Standard App Page

```
┌──────────────────────────────────────┐
│ Sidebar (72px, fixed)  │  Main       │
│                        │  p-4 lg:p-6 │
│  Logo                  │             │
│  Nav items             │  <content>  │
│  ...                   │             │
│  Settings              │             │
└──────────────────────────────────────┘
```

### Two-Column Page (Clients, Tasks, Payments)

```
Main
├── Left sidebar: lg:w-[260px] — filters, client list, month nav
└── Right content: flex-1 — cards, table, task rows
```

### Invoice Builder

```
Main (full viewport, no outer padding)
├── Top toolbar (sticky): Back | Invoice # | Status | Client | Save | Send | Settings
├── Body: flex
│   ├── Document area (flex-1, scrollable): inline-editable invoice
│   └── Settings panel (lg:w-[240px], fixed right): layout picker, colors, font
└── InvoiceSendModal (portal, z-50)
```

### Settings Page

```
Main
├── Left nav (lg:w-[200px], sticky): 8 tab items
└── Right content (flex-1): SectionGroups stacked vertically
```

### Modal Page (NewInvoiceModal, EditClientModal)

```
Overlay (fixed inset-0, z-50, semi-transparent)
└── Sheet (bg-white, rounded-2xl, max-w-lg, max-h-[85vh])
    ├── Header (border-b)
    ├── Body (flex-1, overflow-y-auto)
    └── Footer CTA (border-t)
```

---

## 7. Animation & Motion

### Keyframes (defined in `src/index.css`)

| Name | Effect | Duration |
|---|---|---|
| `fadeIn` | opacity 0→1, translateY 4px→0 | 200ms ease |
| `slideDown` | opacity 0→1, translateY -8px→0 | 150ms ease |
| `slideUp` | opacity 0→1, translateY 12px→0 | 200ms ease |
| `scaleIn` | opacity 0→1, scale 0.92→1 | 200ms ease |
| `scaleOut` | opacity 1→0, scale 1→0.92 | 200ms ease |
| `scaleBounce` | scale 1→1.2→1 | 200ms ease |
| `shake` | translateX ±4px oscillation | 200ms ease |
| `fadeOut` | opacity 1→0, translateY -4px | 200ms ease, forwards |
| `slowRotate` | 0→360deg | 8s infinite ease-in-out |

### Utility Animation Classes

| Class | Animation |
|---|---|
| `animate-fadeIn` | fadeIn |
| `animate-slideUp` | slideUp (mobile modal entry) |
| `animate-slideDown` | slideDown (desktop modal entry) |
| `animate-scale-in` | scaleIn |
| `animate-scale-out` | scaleOut |
| `animate-slow-rotate` | slowRotate (What's New badge) |
| `animate-spin` | Tailwind built-in (Loader2 icons) |
| `.page-enter` | opacity 0→1 on route change, 200ms |

### Transition Conventions

| Class | Duration | Used for |
|---|---|---|
| `transition-colors` | 150ms | Color changes (hover, active states) |
| `transition-all duration-150` | 150ms | Quick UI interactions (buttons, nav) |
| `transition-all duration-300` | 300ms | Card animations, panel slides |
| `transition-opacity` | 150ms | Fade toggles |
| `transition-transform` | 150ms | Toggle thumbs, card lifts |

### Motion Principles

- **Quick interactions** (buttons, nav, inputs): 150ms
- **Content transitions** (modals, panels): 200ms
- **Ambient/decorative** (badges, rings): 300ms–8s
- **Hover lifts**: `hover:-translate-y-0.5` + `hover:shadow-md` on cards
- **Progress rings**: `transition: stroke-dasharray 0.5s ease`
- No animation on disabled or loading skeleton states — use opacity only

---

## 8. Icon Library

All icons from **`lucide-react`**. Import only what you use.

| Category | Icons |
|---|---|
| Navigation | `LayoutDashboard`, `Users`, `ListTodo`, `FileText`, `Settings`, `CreditCard` |
| Actions | `Plus`, `Trash2`, `Edit3`, `Edit2`, `Check`, `X`, `Copy`, `Upload`, `FileDown` |
| Status | `CheckCircle2`, `Circle`, `AlertTriangle`, `AlertCircle`, `Info`, `Ban` |
| Direction | `ChevronDown`, `ChevronUp`, `ChevronLeft`, `ChevronRight`, `ArrowRight`, `ArrowLeft` |
| Media | `Image`, `Camera`, `Paperclip`, `Layout` |
| Data | `TrendingUp`, `History`, `Database`, `LayoutGrid`, `List` |
| Communication | `Mail`, `Link2`, `Eye`, `EyeOff`, `Bell`, `Webhook` |
| Async | `Loader2`, `RefreshCw` |
| Time | `Calendar`, `Clock` |
| Organization | `GripVertical`, `Tag`, `FolderOpen`, `Search` |
| Security | `KeyRound`, `Shield`, `Lock` |
| Branding | `Sparkles`, `Star`, `Palette`, `Type`, `Monitor` |
| People | `User`, `Building2` |
| Contact | `Phone`, `Globe`, `MapPin` |
| Misc | `ExternalLink`, `RotateCcw`, `LogOut`, `ToggleLeft`, `DollarSign`, `Zap` |

**Size conventions:**
- Sidebar nav icons: `size={20}` (desktop), `size={22}` (mobile)
- Button icons: `size={16}` or `size={18}`
- Stat card icons: `size={18}`
- Close / utility icons: `size={18}`
- Large decorative: `size={28}`–`size={40}`

---

## 9. Screen Inventory

| Page | Route | Description |
|---|---|---|
| **Dashboard** | `/` | Swipeable activity/task card, stat cards (earned, tasks, overdue), client task list, sidebar with month filters |
| **Task Dashboard** | `/` (tasks mode) | Alt home when `app_mode = 'tasks'` — completion ring, task rows by group, activity summary |
| **Clients** | `/clients` | Grid/list of clients with colored cards, progress bars, task counts, add/search/delete |
| **Client Workspace** | `/clients/:id` | Tabbed client detail: Tasks (inline edit, status), Retainer, Files, Notes |
| **Tasks** | `/tasks` | Task groups with SVG completion rings, task rows with checkbox + deadline indicators |
| **Task Group Workspace** | `/tasks/:id` | Single group detail: task list, completion metrics, sidebar context |
| **Payments** | `/payments` | Sidebar filters (client, status), payment table with amounts, badges, actions |
| **Invoices** | `/invoices` | Invoice table (number, client, amount, status, date) + stat cards + NewInvoiceModal |
| **Invoice Builder** | `/invoices/new` `/invoices/:id` | Two-panel: left (inline-editable document, 4 layouts), right (settings panel — font, colors, currency) |
| **Settings** | `/settings` | 8-tab left nav: Profile, Branding, Business Info, Payments, General, Emails, Integrations, Billing |
| **Login** | `/login` | Email/password auth + Google OAuth, centered card layout |
| **Onboarding** | `/onboarding` | New-user setup: company info, getting started steps |
| **Public Invoice** | `/invoice/:token` | Token-gated read-only invoice document, download PDF button, no auth required |
| **Shared Client** | `/share/:token` | Public client workspace view — task list, client info, no editing |

---

## 10. Design Principles

### Visual Language

- **Clean and minimal** — ample white space, light gray backgrounds, white card surfaces. Let content breathe.
- **Hierarchy through weight** — convey importance via font weight and size, not color.
- **Color is intentional** — accent color signals interactivity. Status colors signal meaning. Gray is neutral.

### Interaction Model

- **Micro-feedback on everything** — every hover, focus, and click has a visible response (color, shadow, translate).
- **150ms for interactions, 200ms for transitions** — quick enough to feel snappy, slow enough to feel smooth.
- **Disabled ≠ invisible** — always `opacity-40`, never `display: none`, so layout stays stable.
- **Hover lift on cards** — `hover:-translate-y-0.5 hover:shadow-md` gives depth cues without layout shift.

### Responsiveness

- **Mobile-first** — design for the smallest screen, enhance for larger.
- **Sidebar collapses** — desktop: fixed 72px left sidebar. Mobile: bottom nav bar.
- **Min touch targets** — `min-height: 44px` on all interactive elements on mobile (`@media (max-width: 768px)`).
- **iOS safe area** — bottom nav respects `env(safe-area-inset-bottom)`.
- **No horizontal scroll** — `overflow-x: hidden` on `html, body, #root`.

### Consistency Rules

- Cards → `rounded-2xl`
- Buttons / inputs / nav items → `rounded-xl`
- Badges / pills / avatars → `rounded-full`
- Default card shadow → `shadow-sm`; hover → `shadow-md`
- All transitions → `transition-all duration-150` unless decorative
- Modals → always `z-50`, overlay `rgba(0,0,0,0.4)`, max-h `85vh` with scroll

### Theming

- `--accent` is user-controlled from Settings → Branding
- All brand-color usage goes through `var(--accent)` or `style={{ color/backgroundColor: accent }}`
- Never hardcode `#ED64A6` in components — always reference the variable or prop
- Logo, company name, and currency are also user-controlled and flow into invoices automatically

### Accessibility

- Minimum contrast: gray-400 on white is the floor — use gray-500+ for important text
- Interactive elements always have `:hover` and `:focus` states
- 44px min touch targets on mobile
- `disabled:opacity-40` maintains visual hierarchy even for inactive controls
- Semantic HTML — `<button>` for actions, `<a>` / `<NavLink>` for navigation, not `<div onClick>`

---

*Last updated: 2026-04-25*
