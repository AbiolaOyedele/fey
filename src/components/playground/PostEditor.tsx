'use client'

import { useState } from 'react'
import { X, Trash2, ListTodo, Check, Layers } from 'lucide-react'
import { SOCIAL_POST_STATUSES, SOCIAL_POST_FORMATS } from '@/types/social'
import type { SocialBrand, SocialPost, SocialPostFormat, SocialPostStatus, CreatePostPayload } from '@/types/social'

export const STATUS_STYLES: Record<SocialPostStatus, { bg: string; text: string }> = {
  draft: { bg: '#F3F4F6', text: '#6B7280' },
  pending_review: { bg: '#FEF3C7', text: '#B45309' },
  reviewed: { bg: '#E0F2FE', text: '#0369A1' },
  approved: { bg: '#D1FAE5', text: '#047857' },
}

interface PostEditorProps {
  /** null = creating a new post. */
  post: SocialPost | null
  /** Prefilled calendar day (YYYY-MM-DD) when creating. */
  defaultDate: string
  defaultBrandId: string | null
  brands: SocialBrand[]
  accent: string
  onCreate: (payload: CreatePostPayload) => Promise<void>
  onUpdate: (id: string, payload: Partial<CreatePostPayload>) => Promise<void>
  onDelete: ((id: string) => Promise<void>) | null
  onMarkTask: ((id: string) => Promise<void>) | null
  onClose: () => void
}

interface FormState {
  brand_id: string
  scheduled_date: string
  scheduled_time: string
  title: string
  content_pillar: string
  format: SocialPostFormat | ''
  visual_notes: string
  caption: string
  inspo_url: string
  status: SocialPostStatus
}

const emptyForm = (date: string, brandId: string): FormState => ({
  brand_id: brandId,
  scheduled_date: date,
  scheduled_time: '',
  title: '',
  content_pillar: '',
  format: '',
  visual_notes: '',
  caption: '',
  inspo_url: '',
  status: 'draft',
})

const fromPost = (p: SocialPost): FormState => ({
  brand_id: p.brand_id,
  scheduled_date: p.scheduled_date,
  scheduled_time: p.scheduled_time?.slice(0, 5) ?? '',
  title: p.title,
  content_pillar: p.content_pillar ?? '',
  format: p.format ?? '',
  visual_notes: p.visual_notes ?? '',
  caption: p.caption ?? '',
  inspo_url: p.inspo_url ?? '',
  status: p.status,
})

const inputCls = 'w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-800 focus:border-gray-400 focus:bg-white outline-none transition-colors'
const labelCls = 'block text-xs font-medium text-gray-500 mb-1.5'

/**
 * The post card — create or edit a scheduled post. In create mode, "Save & next"
 * keeps the card open with a fresh form (batch mode) so a whole week can be
 * filled without leaving the card.
 */
export default function PostEditor({
  post, defaultDate, defaultBrandId, brands, accent,
  onCreate, onUpdate, onDelete, onMarkTask, onClose,
}: PostEditorProps) {
  const [form, setForm] = useState<FormState>(
    post ? fromPost(post) : emptyForm(defaultDate, defaultBrandId ?? brands[0]?.id ?? ''),
  )
  const [saving, setSaving] = useState(false)
  const [batchCount, setBatchCount] = useState(0)

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }))

  const toPayload = (): CreatePostPayload => ({
    brand_id: form.brand_id,
    scheduled_date: form.scheduled_date,
    scheduled_time: form.scheduled_time || null,
    title: form.title.trim(),
    content_pillar: form.content_pillar.trim() || null,
    format: form.format || null,
    visual_notes: form.visual_notes.trim() || null,
    caption: form.caption.trim() || null,
    inspo_url: form.inspo_url.trim() || null,
    status: form.status,
  })

  const canSave = form.title.trim().length > 0 && form.brand_id && !saving

  const save = async (keepOpen: boolean) => {
    if (!canSave) return
    setSaving(true)
    try {
      if (post) {
        await onUpdate(post.id, toPayload())
        onClose()
      } else {
        await onCreate(toPayload())
        if (keepOpen) {
          // Batch mode: fresh card, same day and brand — keep filling.
          setForm(emptyForm(form.scheduled_date, form.brand_id))
          setBatchCount((n) => n + 1)
        } else {
          onClose()
        }
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-end md:items-center justify-center z-50 animate-fadeIn" onClick={onClose}>
      <div
        className="bg-white rounded-t-2xl md:rounded-2xl w-full md:max-w-lg shadow-xl animate-slideUp max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-lg text-gray-800">{post ? 'Edit post' : 'New post'}</h2>
            {batchCount > 0 && (
              <span className="inline-flex items-center gap-1 text-2xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                <Layers size={10} /> {batchCount} saved
              </span>
            )}
          </div>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500 transition-colors"><X size={16} /></button>
        </div>

        <div className="px-6 py-4 overflow-y-auto space-y-4">
          {/* Status selector */}
          <div className="flex flex-wrap gap-1.5">
            {SOCIAL_POST_STATUSES.map((s) => {
              const active = form.status === s.value
              const style = STATUS_STYLES[s.value]
              return (
                <button
                  key={s.value}
                  onClick={() => set('status', s.value)}
                  className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-all ${active ? '' : 'bg-gray-50 text-gray-400 hover:text-gray-600'}`}
                  style={active ? { backgroundColor: style.bg, color: style.text } : undefined}
                >
                  {active && <Check size={11} className="inline mr-1 -mt-0.5" />}
                  {s.label}
                </button>
              )
            })}
          </div>

          <div>
            <label className={labelCls}>Title</label>
            <input
              autoFocus
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="e.g. Spend everywhere — travel spotlight"
              className={inputCls}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Brand</label>
              <select value={form.brand_id} onChange={(e) => set('brand_id', e.target.value)} className={inputCls}>
                {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Content pillar</label>
              <input
                value={form.content_pillar}
                onChange={(e) => set('content_pillar', e.target.value)}
                placeholder="e.g. The world is yours"
                className={inputCls}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Date</label>
              <input type="date" value={form.scheduled_date} onChange={(e) => set('scheduled_date', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Time</label>
              <input type="time" value={form.scheduled_time} onChange={(e) => set('scheduled_time', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Format</label>
              <select value={form.format} onChange={(e) => set('format', e.target.value as SocialPostFormat | '')} className={inputCls}>
                <option value="">—</option>
                {SOCIAL_POST_FORMATS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className={labelCls}>Visual</label>
            <textarea
              value={form.visual_notes}
              onChange={(e) => set('visual_notes', e.target.value)}
              placeholder={'Describe the visual…\ne.g. Go where the plan takes you / Book the trip / Order the drink'}
              rows={3}
              className={`${inputCls} resize-y`}
            />
          </div>

          <div>
            <label className={labelCls}>Caption</label>
            <textarea
              value={form.caption}
              onChange={(e) => set('caption', e.target.value)}
              placeholder="The caption that ships with the post…"
              rows={3}
              className={`${inputCls} resize-y`}
            />
          </div>

          <div>
            <label className={labelCls}>Inspo link</label>
            <input
              value={form.inspo_url}
              onChange={(e) => set('inspo_url', e.target.value)}
              placeholder="https://…"
              className={inputCls}
            />
          </div>
        </div>

        <div className="flex items-center gap-2 px-6 py-4 border-t border-gray-100 flex-shrink-0">
          {post && onDelete && (
            <button
              onClick={() => void onDelete(post.id)}
              title="Delete post"
              className="w-10 h-10 rounded-xl flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
            >
              <Trash2 size={16} />
            </button>
          )}
          {post && onMarkTask && (
            post.work_task_id ? (
              <span className="inline-flex items-center gap-1.5 text-xs text-gray-400 px-2">
                <ListTodo size={13} /> On the Tasks page
              </span>
            ) : (
              <button
                onClick={() => void onMarkTask(post.id)}
                className="inline-flex items-center gap-1.5 text-xs font-medium px-3 h-10 rounded-xl text-gray-500 hover:text-gray-800 hover:bg-gray-50 transition-colors"
              >
                <ListTodo size={13} /> Make it a task
              </button>
            )
          )}
          <div className="flex-1" />
          {!post && (
            <button
              onClick={() => void save(true)}
              disabled={!canSave}
              className="h-10 px-4 rounded-xl text-sm font-medium border transition-colors disabled:opacity-40 hover:bg-gray-50"
              style={{ borderColor: accent, color: accent }}
              title="Save this post and start the next one"
            >
              Save & next
            </button>
          )}
          <button
            onClick={() => void save(false)}
            disabled={!canSave}
            className="h-10 px-5 rounded-xl text-sm font-medium text-white transition-opacity disabled:opacity-40 hover:opacity-90"
            style={{ backgroundColor: accent }}
          >
            {saving ? 'Saving…' : post ? 'Save changes' : 'Save post'}
          </button>
        </div>
      </div>
    </div>
  )
}
