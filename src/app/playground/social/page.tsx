'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, Megaphone, Plus, ArrowLeft, Pencil, CalendarDays } from 'lucide-react'
import { useSettings } from '@/contexts/SettingsContext'
import { useConfirm } from '@/contexts/ConfirmContext'
import { useWorkspace } from '@/hooks/useWorkspace'
import { useContacts } from '@/hooks/useCrm'
import { useSocialPlanner, toDateKey } from '@/hooks/useSocialPlanner'
import { FadeIn } from '@/components/ui/motion'
import SocialCalendar from '@/components/playground/SocialCalendar'
import DayPanel from '@/components/playground/DayPanel'
import PostEditor, { STATUS_STYLES } from '@/components/playground/PostEditor'
import BrandModal from '@/components/playground/BrandModal'
import { SOCIAL_POST_STATUSES } from '@/types/social'
import type { SocialBrand, SocialPost, CreatePostPayload } from '@/types/social'

type EditorState =
  | { mode: 'create'; date: string; brandId: string | null }
  | { mode: 'edit'; post: SocialPost }
  | null

/** Playground · Social Corner — per-brand content calendars for the social team. */
export default function SocialCornerPage() {
  const { settings, showToast } = useSettings()
  const accent = settings.accent_color || '#ED64A6'
  const confirm = useConfirm()
  const { workspace, loading: wsLoading } = useWorkspace()
  const { contacts } = useContacts()

  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })
  // -1 | 1 — which way the visible month last moved, so the grid slides that way.
  const [monthDir, setMonthDir] = useState(0)
  const [brandFilter, setBrandFilter] = useState<string | null>(null)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [editor, setEditor] = useState<EditorState>(null)
  const [brandModal, setBrandModal] = useState<{ brand: SocialBrand | null } | null>(null)

  const {
    brands, posts, brandById, loading, error, refetch,
    createBrand, updateBrand, deleteBrand,
    createPost, updatePost, deletePost, markAsTask,
  } = useSocialPlanner({ workspaceId: workspace?.id ?? null, month })

  // Brand filter is a pure view concern — applied client-side.
  const visiblePosts = useMemo(
    () => (brandFilter ? posts.filter((p) => p.brand_id === brandFilter) : posts),
    [posts, brandFilter],
  )
  const postsByDay = useMemo(() => {
    const map = new Map<string, SocialPost[]>()
    for (const p of visiblePosts) {
      const list = map.get(p.scheduled_date) ?? []
      list.push(p)
      map.set(p.scheduled_date, list)
    }
    return map
  }, [visiblePosts])

  const monthKey = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`
  const monthPosts = useMemo(() => visiblePosts.filter((p) => p.scheduled_date.startsWith(monthKey)), [visiblePosts, monthKey])
  const statusCounts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const p of monthPosts) c[p.status] = (c[p.status] ?? 0) + 1
    return c
  }, [monthPosts])

  const postCountByBrand = useMemo(() => {
    const c = new Map<string, number>()
    for (const p of posts) if (p.scheduled_date.startsWith(monthKey)) c.set(p.brand_id, (c.get(p.brand_id) ?? 0) + 1)
    return c
  }, [posts, monthKey])

  const monthLabel = month.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
  const shiftMonth = (delta: number) => {
    setMonthDir(delta > 0 ? 1 : -1)
    setMonth((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1))
    setSelectedDay(null)
  }

  const withToast = async (fn: () => Promise<unknown>, ok: string) => {
    try { await fn(); showToast(ok) } catch (e) { showToast(e instanceof Error ? e.message : 'Something needs another try — please retry.') }
  }

  const handleCreatePost = (payload: CreatePostPayload) => withToast(() => createPost(payload), 'Post scheduled')
  const handleUpdatePost = (id: string, payload: Partial<CreatePostPayload>) => withToast(() => updatePost(id, payload), 'Post updated')
  const handleDeletePost = async (id: string) => {
    if (!(await confirm({ title: 'Delete this post?', message: 'This removes it from the calendar.', confirmLabel: 'Delete' }))) return
    setEditor(null)
    await withToast(() => deletePost(id), 'Post deleted')
  }
  const handleMarkTask = (id: string) => withToast(() => markAsTask(id), 'Added to the Tasks page')

  const handleSaveBrand = async (values: { name: string; color: string; contact_id: string | null }) => {
    const editing = brandModal?.brand ?? null
    await withToast(
      () => (editing ? updateBrand(editing.id, values) : createBrand(values)),
      editing ? 'Brand updated' : 'Brand created',
    )
    setBrandModal(null)
  }
  const handleDeleteBrand = async () => {
    const brand = brandModal?.brand
    if (!brand) return
    if (!(await confirm({
      title: `Delete ${brand.name}?`,
      message: 'Its whole calendar goes with it. This can’t be undone.',
      confirmLabel: 'Delete brand',
    }))) return
    setBrandModal(null)
    if (brandFilter === brand.id) setBrandFilter(null)
    await withToast(() => deleteBrand(brand.id), 'Brand deleted')
  }

  const dayPosts = selectedDay ? (postsByDay.get(selectedDay) ?? []) : []

  return (
    <div className="p-4 md:p-6 lg:p-8 page-enter">
      {/* Header */}
      <FadeIn>
        <div className="flex items-center gap-2 mb-1">
          <Link href="/playground" title="Back to Playground" className="text-gray-300 hover:text-gray-600 transition-colors">
            <ArrowLeft size={16} />
          </Link>
          <Megaphone size={18} style={{ color: accent }} />
          <h1 className="font-display text-xl font-normal text-gray-800">Social Corner</h1>
        </div>
        <p className="text-xs text-gray-400 mb-4">Every brand’s content calendar, one place. Click a day to plan it.</p>
      </FadeIn>

      {/* Toolbar: month nav + stats + actions */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="flex items-center gap-1 bg-white border border-gray-100 rounded-xl px-1 py-1 shadow-sm">
          <button onClick={() => shiftMonth(-1)} className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-50"><ChevronLeft size={15} /></button>
          <span className="text-sm font-medium text-gray-800 px-2 min-w-[130px] text-center">{monthLabel}</span>
          <button onClick={() => shiftMonth(1)} className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-50"><ChevronRight size={15} /></button>
        </div>
        <button
          onClick={() => { const d = new Date(); setMonth(new Date(d.getFullYear(), d.getMonth(), 1)); setSelectedDay(toDateKey(d)) }}
          className="text-xs font-medium px-3 h-9 rounded-xl bg-white border border-gray-100 shadow-sm text-gray-500 hover:text-gray-800 transition-colors"
        >
          Today
        </button>

        {/* Month-at-a-glance (the dashboard strip) */}
        <div className="hidden md:flex items-center gap-1.5 ml-1">
          <span className="text-xs text-gray-400">{monthPosts.length} post{monthPosts.length === 1 ? '' : 's'}</span>
          {SOCIAL_POST_STATUSES.map((s) => {
            const n = statusCounts[s.value] ?? 0
            if (n === 0) return null
            const st = STATUS_STYLES[s.value]
            return (
              <span key={s.value} className="text-2xs font-medium px-2 py-1 rounded-lg" style={{ backgroundColor: st.bg, color: st.text }}>
                {n} {s.label.toLowerCase()}
              </span>
            )
          })}
        </div>

        <div className="flex-1" />
        <button
          onClick={() => setEditor({ mode: 'create', date: selectedDay ?? toDateKey(new Date()), brandId: brandFilter })}
          disabled={brands.length === 0}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-white px-4 h-9 rounded-xl transition-opacity hover:opacity-90 disabled:opacity-40"
          style={{ backgroundColor: accent }}
        >
          <Plus size={15} /> New post
        </button>
      </div>

      {/* Brand filter rail */}
      <div className="flex items-center gap-1.5 mb-4 overflow-x-auto pb-1">
        <button
          onClick={() => setBrandFilter(null)}
          className={`flex-shrink-0 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${brandFilter === null ? 'text-gray-800 bg-white border border-gray-200 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
        >
          All brands
        </button>
        {brands.map((b) => {
          const active = brandFilter === b.id
          const n = postCountByBrand.get(b.id) ?? 0
          return (
            <span key={b.id} className="flex-shrink-0 inline-flex items-center">
              <button
                onClick={() => setBrandFilter(active ? null : b.id)}
                className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-all ${active ? 'text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
                style={{ backgroundColor: active ? b.color : `${b.color}66` }}
              >
                {b.name}
                {n > 0 && <span className="text-2xs opacity-60">{n}</span>}
              </button>
              {active && (
                <button
                  onClick={() => setBrandModal({ brand: b })}
                  title={`Edit ${b.name}`}
                  className="ml-0.5 w-6 h-6 rounded-md flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  <Pencil size={11} />
                </button>
              )}
            </span>
          )
        })}
        <button
          onClick={() => setBrandModal({ brand: null })}
          className="flex-shrink-0 inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-dashed border-gray-200 text-gray-400 hover:text-gray-600 hover:border-gray-300 transition-colors"
        >
          <Plus size={12} /> Brand
        </button>
      </div>

      {/* Body */}
      {wsLoading || loading ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: 35 }).map((_, i) => (
              <div key={i} className="h-20 bg-gray-50 rounded-lg animate-pulse" />
            ))}
          </div>
        </div>
      ) : error ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-16 text-center">
          <p className="text-sm text-gray-500 mb-3">The calendar didn’t load. {error}</p>
          <button onClick={() => void refetch()} className="text-sm font-medium hover:underline" style={{ color: accent }}>Try again</button>
        </div>
      ) : brands.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-20 text-center">
          <CalendarDays size={36} className="mx-auto text-gray-200 mb-3" />
          <p className="text-sm font-medium text-gray-600">Start with a brand</p>
          <p className="text-xs text-gray-400 mt-1 mb-4">Each brand gets its own color-coded calendar space.</p>
          <button
            onClick={() => setBrandModal({ brand: null })}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-white px-4 h-9 rounded-xl hover:opacity-90 transition-opacity"
            style={{ backgroundColor: accent }}
          >
            <Plus size={15} /> Create your first brand
          </button>
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-4 items-stretch">
          {/* Calendar collapses to the side when a day is open */}
          <div className={`min-w-0 transition-all duration-300 ${selectedDay ? 'lg:w-[55%]' : 'w-full'}`}>
            {/* Keyed on the month so switching months slides the grid in from the travel direction. */}
            <motion.div
              key={monthKey}
              initial={{ opacity: 0, x: monthDir * 32 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            >
              <SocialCalendar
                month={month}
                postsByDay={postsByDay}
                brandById={brandById}
                selectedDay={selectedDay}
                compact={selectedDay !== null}
                accent={accent}
                onSelectDay={(key) => setSelectedDay((cur) => (cur === key ? null : key))}
              />
            </motion.div>
          </div>
          <AnimatePresence>
            {selectedDay && (
              <motion.div
                key="day-panel"
                initial={{ opacity: 0, x: 32, scale: 0.98 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 24, scale: 0.98, transition: { duration: 0.15 } }}
                transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                className="lg:w-[45%] min-w-0 lg:max-h-[calc(100vh-16rem)]"
              >
                <DayPanel
                  dateKey={selectedDay}
                  posts={dayPosts}
                  brandById={brandById}
                  accent={accent}
                  onEdit={(post) => setEditor({ mode: 'edit', post })}
                  onAdd={() => setEditor({ mode: 'create', date: selectedDay, brandId: brandFilter })}
                  onMarkTask={(post) => void handleMarkTask(post.id)}
                  onClose={() => setSelectedDay(null)}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Modals */}
      {editor && (
        <PostEditor
          post={editor.mode === 'edit' ? editor.post : null}
          defaultDate={editor.mode === 'create' ? editor.date : toDateKey(new Date())}
          defaultBrandId={editor.mode === 'create' ? editor.brandId : null}
          brands={brands}
          accent={accent}
          onCreate={handleCreatePost}
          onUpdate={handleUpdatePost}
          onDelete={editor.mode === 'edit' ? handleDeletePost : null}
          onMarkTask={editor.mode === 'edit' ? handleMarkTask : null}
          onClose={() => setEditor(null)}
        />
      )}
      {brandModal && (
        <BrandModal
          brand={brandModal.brand}
          contacts={contacts.map((c) => ({ id: c.id, name: c.name }))}
          accent={accent}
          onSave={handleSaveBrand}
          onDelete={brandModal.brand ? handleDeleteBrand : undefined}
          onClose={() => setBrandModal(null)}
        />
      )}
    </div>
  )
}
