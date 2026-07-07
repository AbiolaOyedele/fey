'use client'

import { useRef } from 'react'
import { motion, useScroll, useTransform, type MotionValue } from 'framer-motion'
import { ImageOff, Paperclip, MapPin, Clock } from 'lucide-react'
import type { SocialBrand, SocialPost } from '@/types/social'
import { STATUS_STYLES } from './PostEditor'
import { SOCIAL_POST_FORMATS, SOCIAL_POST_STATUSES } from '@/types/social'
import { useSocialPostFiles } from '@/hooks/useSocialPostFiles'
import { thumbUrl, isImageType, getFileType, type FileType } from '@/utils/cloudinary'

// Fixed so the scroll container and every slide agree on exactly how tall
// "one card's worth" of scroll is — percentage heights can't resolve this
// because the list wrapper between them has no explicit height of its own.
// The card must stay meaningfully shorter than the container — the fan/peek
// effect comes from the gap between a card's edge and the container's, so a
// card that nearly fills its slide leaves no room for the next one to show
// through underneath it.
const STACK_VH = 96
const CARD_HEIGHT = 'min(580px, 62vh)'

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
      style={{ height: `${STACK_VH}vh` }}
      className="flex items-center justify-center sticky top-0"
    >
      <motion.div
        style={{ scale, top: `calc(-8vh + ${i * 34}px)`, height: CARD_HEIGHT }}
        className="relative -top-[25%] w-[88%] max-w-6xl rounded-3xl border border-gray-200 bg-white shadow-xl shadow-gray-300/30 origin-top overflow-hidden"
      >
        {/* Bold date, top-left */}
        <div className="absolute top-6 left-7 leading-none z-10">
          <p className="text-4xl font-bold text-gray-900 tabular-nums">{day}</p>
          <p className="text-xs font-semibold text-gray-400 tracking-wide mt-1">{month}</p>
        </div>

        <div className="flex h-full">
          {/* Details — left */}
          <div className="w-[38%] flex-shrink-0 flex flex-col justify-center pl-7 pr-6 pt-24 pb-8">
            {brand && (
              <span className="inline-flex items-center gap-1.5 text-2xs font-medium text-gray-400 uppercase tracking-wide mb-2">
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: brand.color }} />
                {brand.name}
              </span>
            )}
            <h3 className="font-display text-2xl text-gray-900 leading-snug">{post.title}</h3>

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
                <span className="inline-flex items-center text-2xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
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
                <p className="text-sm text-gray-600 leading-relaxed line-clamp-5">{post.visual_notes}</p>
              </div>
            )}

            {post.caption && (
              <div className="mt-4">
                <p className="text-3xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Caption</p>
                <p className="text-sm text-gray-500 leading-relaxed line-clamp-4">{post.caption}</p>
              </div>
            )}

            <div className="flex items-center gap-3 mt-5">
              <button
                onClick={() => onOpen(post)}
                className="inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
                style={{ color: accent }}
              >
                Open post →
              </button>
              {post.inspo_url && (
                <a
                  href={post.inspo_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600"
                >
                  <MapPin size={11} /> Inspo link
                </a>
              )}
            </div>
          </div>

          {/* Inspiration image(s) — right */}
          <div className="relative w-[62%] h-full bg-gray-50 border-l border-gray-100 overflow-hidden">
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
 *  of the next as you scroll — date bold top-left, details on the left,
 *  inspiration image(s) on the right. Monochrome; no per-brand color fills.
 *
 *  Scrolls inside its own panel rather than the page: the app shell sets
 *  `overflow-x-hidden` on a few ancestors, which per spec forces their
 *  `overflow-y` to `auto` too — making one of them (not the real page
 *  scroller) the nearest ancestor scroll container, so `position: sticky`
 *  silently no-ops against the window. Owning our own scroll container
 *  sidesteps that entirely. */
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
      style={{ height: `${STACK_VH}vh` }}
      className="overflow-y-auto overflow-x-hidden rounded-3xl bg-gray-50/60"
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
