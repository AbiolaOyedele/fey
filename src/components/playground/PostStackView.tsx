'use client'

import { useRef } from 'react'
import { motion, useScroll, useTransform, type MotionValue } from 'framer-motion'
import { ImageOff, Paperclip, MapPin, Clock } from 'lucide-react'
import type { SocialBrand, SocialPost } from '@/types/social'
import { STATUS_STYLES } from './PostEditor'
import { SOCIAL_POST_FORMATS, SOCIAL_POST_STATUSES } from '@/types/social'
import { useSocialPostFiles } from '@/hooks/useSocialPostFiles'
import { thumbUrl, isImageType, getFileType, type FileType } from '@/utils/cloudinary'

// `dvh` (not `vh`) so mobile browser chrome collapsing/expanding the address
// bar doesn't push content below the fold — `vh` is measured against the
// largest possible viewport, which clips the bottom of the card on phones.
const STACK_DVH = 92

const statusLabel = (s: SocialPost['status']) => SOCIAL_POST_STATUSES.find((x) => x.value === s)?.label ?? s
const formatLabel = (f: SocialPost['format']) => SOCIAL_POST_FORMATS.find((x) => x.value === f)?.label ?? null

/** "14:00:00" → "2pm", "14:30:00" → "2:30pm" */
function timeChip(t: string | null): string | null {
  if (!t) return null
  const [h, m] = t.split(':').map(Number)
  const hr12 = ((h + 11) % 12) + 1
  return m ? `${hr12}:${String(m).padStart(2, '0')}${h < 12 ? 'am' : 'pm'}` : `${hr12}${h < 12 ? 'am' : 'pm'}`
}

function StackCard({
  post, brand, i, total, accent, progress, scrollContainer, targetScale, onOpen,
}: {
  post: SocialPost
  brand: SocialBrand | undefined
  i: number
  total: number
  accent: string
  progress: MotionValue<number>
  scrollContainer: React.RefObject<HTMLDivElement | null>
  targetScale: number
  onOpen: (post: SocialPost) => void
}) {
  const cardRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ container: scrollContainer, target: cardRef, offset: ['start end', 'start start'] })
  const imageScale = useTransform(scrollYProgress, [0, 1], [1.25, 1])
  const scale = useTransform(progress, [i * (1 / total), 1], [1, targetScale])

  const { files } = useSocialPostFiles(post.id, true)
  const images = files.filter((f) => isImageType((f.file_type as FileType) ?? getFileType(f.file_name)))

  const d = new Date(post.scheduled_date + 'T00:00:00')
  const day = d.getDate()
  const month = d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()
  const format = formatLabel(post.format)
  const time = timeChip(post.scheduled_time)

  return (
    <div
      ref={cardRef}
      style={{ height: `${STACK_DVH}dvh` }}
      className="flex items-center justify-center sticky top-0 px-3 sm:px-0"
    >
      {/* Centered by the flex wrapper above; only a small per-card nudge (`y`)
       *  and `scale` are animated, so the stack fans out without fighting the
       *  centering — no large top-offset hacks that can push a card off-screen. */}
      <motion.div
        style={{ scale, y: i * 12 }}
        className="relative w-full max-w-4xl sm:max-w-5xl max-h-full overflow-y-auto rounded-3xl border border-gray-200 bg-white shadow-xl shadow-gray-300/30 flex flex-col sm:flex-row text-left"
      >
        {/* Bold date, top-left */}
        <div className="absolute top-5 left-5 sm:top-6 sm:left-7 leading-none z-10">
          <p className="text-3xl sm:text-4xl font-bold text-gray-900 tabular-nums">{day}</p>
          <p className="text-2xs sm:text-xs font-semibold text-gray-400 tracking-wide mt-1">{month}</p>
        </div>

        {/* Details */}
        <div className="w-full sm:w-[40%] sm:flex-shrink-0 flex flex-col justify-center text-left px-5 sm:pl-7 sm:pr-6 pt-20 sm:pt-24 pb-5 sm:pb-8">
          {brand && (
            <span className="inline-flex items-center gap-1.5 text-2xs font-medium text-gray-400 uppercase tracking-wide mb-2">
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: brand.color }} />
              {brand.name}
            </span>
          )}
          <h3 className="font-display text-lg sm:text-2xl text-gray-900 leading-snug break-words line-clamp-2">
            {post.title}
          </h3>

          <div className="flex flex-wrap items-center gap-1.5 mt-3">
            <span
              className="inline-flex items-center text-2xs font-medium px-2 py-0.5 rounded-full"
              style={{ backgroundColor: STATUS_STYLES[post.status].bg, color: STATUS_STYLES[post.status].text }}
            >
              {statusLabel(post.status)}
            </span>
            {format && (
              <span className="inline-flex items-center text-2xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                {format}
              </span>
            )}
            {post.content_pillar && (
              <span className="inline-flex items-center text-2xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 break-words">
                {post.content_pillar}
              </span>
            )}
            {time && (
              <span className="inline-flex items-center gap-1 text-2xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                <Clock size={10} /> {time}
              </span>
            )}
          </div>

          {post.visual_notes && (
            <div className="mt-4">
              <p className="text-3xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Visual</p>
              <p className="text-sm text-gray-600 leading-relaxed break-words line-clamp-3 sm:line-clamp-5">{post.visual_notes}</p>
            </div>
          )}

          {post.caption && (
            <div className="mt-4">
              <p className="text-3xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Caption</p>
              <p className="text-sm text-gray-500 leading-relaxed break-words line-clamp-2 sm:line-clamp-4">{post.caption}</p>
            </div>
          )}

          <div className="flex items-center gap-3 mt-5 flex-wrap">
            <button
              onClick={() => onOpen(post)}
              className="inline-flex items-center gap-1.5 text-sm font-medium hover:underline flex-shrink-0"
              style={{ color: accent }}
            >
              Open post →
            </button>
            {post.inspo_url && (
              <a
                href={post.inspo_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 flex-shrink-0"
              >
                <MapPin size={11} /> Inspo link
              </a>
            )}
          </div>
        </div>

        {/* Inspiration image(s) — padded square on mobile, edge-to-edge panel on desktop */}
        <div className="w-full sm:w-[60%] sm:flex-shrink-0 p-4 sm:p-0 sm:h-auto sm:border-l sm:border-gray-100">
          <div className="relative aspect-square sm:aspect-auto sm:h-full rounded-2xl sm:rounded-none overflow-hidden bg-gray-50">
            {images.length === 0 ? (
              <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-gray-300">
                <ImageOff size={26} strokeWidth={1.5} />
                <span className="text-2xs text-gray-300">No inspiration image yet</span>
              </div>
            ) : images.length === 1 ? (
              <motion.div className="w-full h-full" style={{ scale: imageScale }}>
                <img src={thumbUrl(images[0].file_url, 900)} alt="" className="absolute inset-0 w-full h-full object-cover" />
              </motion.div>
            ) : (
              <div className="grid grid-cols-2 grid-rows-2 gap-0.5 w-full h-full">
                {images.slice(0, 4).map((f, idx) => (
                  <div key={f.id} className="relative overflow-hidden bg-gray-100">
                    <img src={thumbUrl(f.file_url, 450)} alt="" className="w-full h-full object-cover" />
                    {idx === 3 && images.length > 4 && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white text-sm font-medium">
                        +{images.length - 4}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  )
}

interface PostStackViewProps {
  posts: SocialPost[]
  brandById: Map<string, SocialBrand>
  accent: string
  onOpen: (post: SocialPost) => void
}

/** Experimental: posts as a scroll-linked stack of cards, one landing on top
 *  of the next as you scroll — date bold top-left, details on the left (or on
 *  top, on mobile), inspiration image(s) on the right (or in a padded square
 *  below, on mobile). Monochrome; no per-brand color fills.
 *
 *  Scrolls inside its own panel rather than the page: the app shell sets
 *  `overflow-x-hidden` on a few ancestors, which per spec forces their
 *  `overflow-y` to `auto` too — making one of them (not the real page
 *  scroller) the nearest ancestor scroll container, so `position: sticky`
 *  silently no-ops against the window. Owning our own scroll container
 *  sidesteps that entirely, and `overscroll-behavior: contain` stops a
 *  scroll gesture from spilling into the page once it hits the top/bottom
 *  of the stack. */
export default function PostStackView({ posts, brandById, accent, onOpen }: PostStackViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ container: scrollRef, offset: ['start start', 'end end'] })

  if (posts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center bg-white rounded-2xl border border-gray-100 shadow-sm">
        <Paperclip size={28} strokeWidth={1.5} className="text-gray-200 mb-3" />
        <p className="text-sm font-medium text-gray-500">Nothing scheduled this month</p>
        <p className="text-xs2 text-gray-400 mt-0.5">Posts you add will stack up here</p>
      </div>
    )
  }

  return (
    <div
      ref={scrollRef}
      style={{ height: `${STACK_DVH}dvh`, overscrollBehavior: 'contain' }}
      className="overflow-y-auto overflow-x-hidden overscroll-contain rounded-3xl bg-gray-50/60"
    >
      {posts.map((post, i) => {
        const targetScale = 1 - (posts.length - i) * 0.05
        return (
          <StackCard
            key={post.id}
            post={post}
            brand={brandById.get(post.brand_id)}
            i={i}
            total={posts.length}
            accent={accent}
            progress={scrollYProgress}
            scrollContainer={scrollRef}
            targetScale={targetScale}
            onOpen={onOpen}
          />
        )
      })}
    </div>
  )
}
