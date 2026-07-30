'use client'

import { useState, useCallback } from 'react'
import { Download, ArrowRight, RotateCcw } from 'lucide-react'
import Dropzone from '@/components/features/ruff-tools/Dropzone'
import Toast from '@/components/features/ruff-tools/Toast'
import { Button, Spinner } from '@/components/features/ruff-tools/ui'
import { useToast, usePaste } from '@/components/features/ruff-tools/hooks'
import { loadImage, canvasToBlob, downloadBlob, stem, CHECKER } from '@/utils/ruffImage'
import type { RuffToolProps } from '@/types/ruffTool'

interface Bounds { left: number; top: number; right: number; bottom: number }

/** Find the tight bounding box of non-transparent pixels (alpha > threshold). */
function findBounds(data: Uint8ClampedArray, w: number, h: number, threshold = 0): Bounds | null {
  let top = 0, bottom = h - 1, left = 0, right = w - 1
  const rowHasPixel = (y: number) => {
    for (let x = 0; x < w; x++) if (data[(y * w + x) * 4 + 3] > threshold) return true
    return false
  }
  const colHasPixel = (x: number) => {
    for (let y = 0; y < h; y++) if (data[(y * w + x) * 4 + 3] > threshold) return true
    return false
  }
  while (top < h && !rowHasPixel(top)) top++
  if (top === h) return null
  while (bottom > top && !rowHasPixel(bottom)) bottom--
  while (left < w && !colHasPixel(left)) left++
  while (right > left && !colHasPixel(right)) right--
  return { left, top, right, bottom }
}

type Phase = 'idle' | 'processing' | 'done'
interface Orig { url: string; w: number; h: number }
interface Result { url: string; blob: Blob; w: number; h: number; name: string }

/** Image Clipper — auto-trim the transparent border of a PNG to the tightest crop. */
export default function ClipperTool({ accent }: RuffToolProps) {
  const { toast, success, error, clear } = useToast()
  const [phase, setPhase] = useState<Phase>('idle')
  const [orig, setOrig] = useState<Orig | null>(null)
  const [result, setResult] = useState<Result | null>(null)

  const reset = () => { setPhase('idle'); setOrig(null); setResult(null) }

  const process = useCallback(async (files: File[]) => {
    const file = files[0]
    if (!file) return
    setPhase('processing')
    try {
      const img = await loadImage(file)
      const c = document.createElement('canvas')
      c.width = img.naturalWidth
      c.height = img.naturalHeight
      const ctx = c.getContext('2d')
      if (!ctx) throw new Error('Canvas unavailable')
      ctx.drawImage(img, 0, 0)
      const { data } = ctx.getImageData(0, 0, c.width, c.height)

      const b = findBounds(data, c.width, c.height)
      if (!b) { error('That image is fully transparent — there is nothing to clip'); setPhase('idle'); return }

      const nw = b.right - b.left + 1
      const nh = b.bottom - b.top + 1
      const out = document.createElement('canvas')
      out.width = nw
      out.height = nh
      out.getContext('2d')?.drawImage(c, b.left, b.top, nw, nh, 0, 0, nw, nh)
      const blob = await canvasToBlob(out)

      setOrig({ url: URL.createObjectURL(file), w: img.naturalWidth, h: img.naturalHeight })
      setResult({ url: URL.createObjectURL(blob), blob, w: nw, h: nh, name: `${stem(file.name)}_clipped.png` })
      setPhase('done')
      if (nw === img.naturalWidth && nh === img.naturalHeight) {
        success('Already tightly cropped — no transparent border to trim')
      } else {
        success(`Trimmed to ${nw} × ${nh}px`)
      }
    } catch (e) {
      error(e instanceof Error ? e.message : 'That image could not be processed')
      setPhase('idle')
    }
  }, [success, error])

  usePaste((file) => process([file]), phase === 'idle')

  return (
    <>
      {phase === 'idle' && (
        <div className="max-w-xl mx-auto">
          <Dropzone
            accept="image/png"
            onFiles={process}
            label="Drop a PNG here or click to upload"
            sub="or paste from clipboard — transparent edges are trimmed off"
          />
          <p className="text-center text-2xs text-gray-400 font-medium mt-4">
            Trims fully-transparent borders to the tightest possible crop.
          </p>
        </div>
      )}

      {phase === 'processing' && <Spinner label="Analysing image" sub="Finding the tightest crop…" />}

      {phase === 'done' && result && orig && (
        <div className="max-w-3xl mx-auto">
          <div className="grid sm:grid-cols-[1fr_auto_1fr] items-center gap-4 mb-6">
            <Panel title="Original" url={orig.url} w={orig.w} h={orig.h} />
            <ArrowRight size={20} className="text-gray-300 mx-auto hidden sm:block" />
            <Panel title="Clipped" url={result.url} w={result.w} h={result.h} accent={accent} />
          </div>

          <div className="text-center text-xs2 text-gray-500 font-medium mb-5">
            {orig.w}×{orig.h} <span className="text-gray-300 mx-1">→</span>
            <span className="text-gray-800 font-semibold">{result.w}×{result.h}</span>
            <span className="ml-2" style={{ color: accent }}>
              ({Math.round((1 - (result.w * result.h) / (orig.w * orig.h)) * 100)}% smaller)
            </span>
          </div>

          <div className="flex justify-center gap-2">
            <Button
              onClick={() => {
                try {
                  downloadBlob(result.blob, result.name)
                  success(`Downloaded at ${result.w} × ${result.h}px`)
                } catch {
                  error('That download could not be started')
                }
              }}
            >
              <Download size={15} /> Download PNG
            </Button>
            <Button variant="secondary" onClick={reset}>
              <RotateCcw size={14} /> Clip another
            </Button>
          </div>
        </div>
      )}

      <Toast toast={toast} onDone={clear} />
    </>
  )
}

function Panel({ title, url, w, h, accent }: { title: string; url: string; w: number; h: number; accent?: string }) {
  return (
    <div>
      <div className="text-2xs font-semibold uppercase tracking-wide text-gray-400 mb-2">{title}</div>
      <div
        className="rounded-2xl overflow-hidden border"
        style={{ ...CHECKER, borderColor: accent ?? '#e5e7eb' }}
      >
        <img src={url} alt={title} className="w-full object-contain max-h-72" />
      </div>
      <div className="text-2xs text-gray-400 font-medium mt-1.5 text-center tabular-nums">{w}×{h}</div>
    </div>
  )
}
