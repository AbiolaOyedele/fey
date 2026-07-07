'use client'

import { useRef } from 'react'
import { motion, useScroll, useTransform, type MotionValue } from 'framer-motion'
import { ImageOff, Paperclip } from 'lucide-react'
import type { SocialBrand, SocialPost } from '@/types/social'
import { STATUS_STYLES } from './PostEditor'
import { SOCIAL_POST_STATUSES } from '@/types/social'
import { useSocialPostFiles } from '@/hooks/useSocialPostFiles'
import { thumbUrl, isImageType, getFileType, type FileType } from '@/utils/cloudinary'

const statusLabel = (s: SocialPost['status']) => SOCIAL_POST_STATUSES.find((x) => x.value === s)?.label ?? s

function StackCard({
  post, brand, index, total, accent, progress, onOpen,
}: {
  post: SocialPost
  brand: SocialBrand | undefined
  index: number
  total: number
  accent: string
  progress: MotionValue<number>
  onOpen: (post: SocialPost) => void
}) {
  const targetScale = 1 - (total - index) * 0.04
  const range: [number, number] = [index * (1 / total), 1]
  const scale = useTransform(progress, range, [1, Math.max(targetScale, 0.85)])
  const { files } = useSocialPostFiles(post.id, true)
  const images = files.filter((f) => isImageType((f.file_type as FileType) ?? getFileType(f.file_name)))

  const d = new Date(post.scheduled_date + 'T00:00:00')
  const day = d.getDate()
  const month = d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()

  return (
    <div className="h-[85vh] flex items-center justify-center sticky top-[6vh]">
      <motion.div
        style={{ scale, top: `${index * 10}px` }}
        className="relative w-full max-w-4xl h-[420px] rounded-3xl border border-gray-200 bg-white shadow-lg shadow-gray-200/40 origin-top overflow-hidden"
      >
        {/* Bold date, top-left */}
        <div className="absolute top-5 left-6 leading-none z-10">
          <p className="text-3xl font-bold text-gray-900 tabular-nums">{day}</p>
          <p className="text-2xs font-semibold text-gray-400 tracking-wide mt-0.5">{month}</p>
        </div>

        <div className="flex h-full">
          {/* Details — left */}
          <div className="w-[42%] flex-shrink-0 flex flex-col justify-center pl-6 pr-5 pt-16 pb-6">
            {brand && (
              <span className="inline-flex items-center gap-1.5 text-2xs font-medium text-gray-400 uppercase tracking-wide mb-2">
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: brand.color }} />
                {brand.name}
              </span>
            )}
            <h3 className="font-display text-xl text-gray-900 leading-snug line-clamp-2">{post.title}</h3>
            <span
              className="inline-flex items-center self-start text-2xs font-medium px-2 py-0.5 rounded-full mt-2.5"
              style={{ backgroundColor: STATUS_STYLES[post.status].bg, color: STATUS_STYLES[post.status].text }}
            >
              {statusLabel(post.status)}
            </span>
            {post.content_pillar && (
              <p className="text-xs2 text-gray-400 mt-3">{post.content_pillar}</p>
            )}
            {(post.caption || post.visual_notes) && (
              <p className="text-sm text-gray-500 leading-relaxed mt-2 line-clamp-4">
                {post.caption || post.visual_notes}
              </p>
            )}
            <button
              onClick={() => onOpen(post)}
              className="inline-flex items-center gap-1.5 text-sm font-medium mt-4 self-start hover:underline"
              style={{ color: accent }}
            >
              Open post →
            </button>
          </div>

          {/* Inspiration image(s) — right */}
          <div className="flex-1 h-full bg-gray-50 border-l border-gray-100">
            {images.length === 0 ? (
              <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-gray-300">
                <ImageOff size={22} strokeWidth={1.5} />
                <span className="text-2xs text-gray-300">No inspiration image yet</span>
              </div>
            ) : images.length === 1 ? (
              <img src={thumbUrl(images[0].file_url, 800)} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="grid grid-cols-2 grid-rows-2 gap-0.5 w-full h-full">
                {images.slice(0, 4).map((f, i) => (
                  <div key={f.id} className="relative overflow-hidden bg-gray-100">
                    <img src={thumbUrl(f.file_url, 400)} alt="" className="w-full h-full object-cover" />
                    {i === 3 && images.length > 4 && (
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

/** Experimental: posts as a scroll-linked stack of cards — date bold top-left,
 *  details on the left, inspiration image(s) on the right. Monochrome, no
 *  per-brand color fills (calendar already carries that signal). */
export default function PostStackView({ posts, brandById, accent, onOpen }: PostStackViewProps) {
  const container = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: container, offset: ['start start', 'end end'] })

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
    <div ref={container} className="relative">
      {posts.map((post, i) => (
        <StackCard
          key={post.id}
          post={post}
          brand={brandById.get(post.brand_id)}
          index={i}
          total={posts.length}
          accent={accent}
          progress={scrollYProgress}
          onOpen={onOpen}
        />
      ))}
    </div>
  )
}
