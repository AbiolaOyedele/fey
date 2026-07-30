'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { Download, RotateCcw, Copy } from 'lucide-react'
import Dropzone from '@/components/features/ruff-tools/Dropzone'
import Toast from '@/components/features/ruff-tools/Toast'
import { Card, Label, Button, Slider, SegGroup } from '@/components/features/ruff-tools/ui'
import { useToast, usePaste } from '@/components/features/ruff-tools/hooks'
import { loadImage, canvasToBlob, downloadBlob, stem } from '@/utils/ruffImage'

/**
 * Instagram's published feed and story sizes. Every export lands on exactly
 * these pixel dimensions, so the crop matches what Instagram renders instead of
 * whatever size the crop box happened to be on screen.
 */
interface Preset { id: string; label: string; w: number; h: number; hint: string }
const PRESETS: Preset[] = [
  { id: 'square', label: 'Square 1:1', w: 1080, h: 1080, hint: '1080 × 1080 — classic feed post' },
  { id: 'portrait', label: 'Portrait 4:5', w: 1080, h: 1350, hint: '1080 × 1350 — tallest a feed post can go' },
  { id: 'landscape', label: 'Landscape 1.91:1', w: 1080, h: 566, hint: '1080 × 566 — widest a feed post can go' },
  { id: 'story', label: 'Story / Reel 9:16', w: 1080, h: 1920, hint: '1080 × 1920 — full-screen story or reel' },
]

interface DragState { startX: number; startY: number; start: { x: number; y: number } }

/** Social Cropper — crop to Instagram's exact sizes with a draggable box. */
export default function SocialCropperTool() {
  const { toast, success, error, clear } = useToast()
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  const [srcUrl, setSrcUrl] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [presetId, setPresetId] = useState(PRESETS[0].id)
  const [zoom, setZoom] = useState(90)
  const [pos, setPos] = useState({ x: 0.5, y: 0.5 })
  const wrapRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<DragState | null>(null)
  const [disp, setDisp] = useState({ w: 0, h: 0 })

  const preset = PRESETS.find((p) => p.id === presetId) ?? PRESETS[0]
  const ratio = preset.w / preset.h

  const onFiles = useCallback(async (files: File[]) => {
    const f = files[0]; if (!f) return
    try {
      const image = await loadImage(f)
      setImg(image)
      setSrcUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(f) })
      setName(stem(f.name))
      setPos({ x: 0.5, y: 0.5 })
      success(`Loaded ${f.name} — ${image.naturalWidth} × ${image.naturalHeight}px`)
    } catch (e) {
      error(e instanceof Error ? e.message : 'That image could not be opened')
    }
  }, [success, error])

  usePaste((file) => onFiles([file]), !img)

  useEffect(() => {
    if (!img || !wrapRef.current) return
    const el = wrapRef.current
    const measure = () => {
      const rect = el.getBoundingClientRect()
      setDisp({ w: rect.width, h: rect.height })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [img])

  const cropBox = (() => {
    if (!disp.w) return { w: 0, h: 0, left: 0, top: 0 }
    const maxW = disp.w, maxH = disp.h
    let w = maxW * (zoom / 100)
    let h = w / ratio
    if (h > maxH * (zoom / 100)) { h = maxH * (zoom / 100); w = h * ratio }
    if (w > maxW) { w = maxW; h = w / ratio }
    if (h > maxH) { h = maxH; w = h * ratio }
    const left = Math.min(Math.max(pos.x * disp.w - w / 2, 0), disp.w - w)
    const top = Math.min(Math.max(pos.y * disp.h - h / 2, 0), disp.h - h)
    return { w, h, left, top }
  })()

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = { startX: e.clientX, startY: e.clientY, start: { ...pos } }
  }
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = dragRef.current; if (!d || !disp.w) return
      const dx = (e.clientX - d.startX) / disp.w
      const dy = (e.clientY - d.startY) / disp.h
      setPos({
        x: Math.min(Math.max(d.start.x + dx, 0), 1),
        y: Math.min(Math.max(d.start.y + dy, 0), 1),
      })
    }
    const up = () => { dragRef.current = null }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [disp])

  /** Source pixels the crop box currently covers. */
  const srcCrop = (() => {
    if (!img || !disp.w) return { x: 0, y: 0, w: 0, h: 0 }
    return {
      x: (cropBox.left / disp.w) * img.naturalWidth,
      y: (cropBox.top / disp.h) * img.naturalHeight,
      w: (cropBox.w / disp.w) * img.naturalWidth,
      h: (cropBox.h / disp.h) * img.naturalHeight,
    }
  })()

  const renderCanvas = (): HTMLCanvasElement | null => {
    if (!img || srcCrop.w < 1 || srcCrop.h < 1) return null
    const canvas = document.createElement('canvas')
    canvas.width = preset.w
    canvas.height = preset.h
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, srcCrop.x, srcCrop.y, srcCrop.w, srcCrop.h, 0, 0, preset.w, preset.h)
    return canvas
  }

  const download = async () => {
    try {
      const canvas = renderCanvas()
      if (!canvas) throw new Error('empty crop')
      const blob = await canvasToBlob(canvas)
      downloadBlob(blob, `${name || 'crop'}_${preset.w}x${preset.h}.png`)
      success(`Downloaded at ${preset.w} × ${preset.h}px`)
    } catch {
      error('That crop could not be exported — try repositioning the box')
    }
  }

  const copy = async () => {
    try {
      const canvas = renderCanvas()
      if (!canvas) throw new Error('empty crop')
      const blob = await canvasToBlob(canvas)
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      success(`Copied at ${preset.w} × ${preset.h}px`)
    } catch {
      error('Your browser blocked the clipboard — use Download instead')
    }
  }

  const reset = () => {
    setImg(null); setName('')
    setSrcUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return null })
  }

  const upscaling = srcCrop.w > 0 && srcCrop.w < preset.w

  return (
    <>
      {!img || !srcUrl ? (
        <div className="max-w-xl mx-auto">
          <Dropzone onFiles={onFiles} label="Drop image here" sub="PNG, JPG, or any image format, or paste" />
        </div>
      ) : (
        <div className="grid lg:grid-cols-[1fr_280px] gap-6 items-start">
          <div>
            <Label>Drag the crop area to reposition</Label>
            <Card className="p-4 flex items-center justify-center select-none">
              {/* overflow-hidden keeps the crop box's dimming shadow on the image
                  instead of letting it wash over the whole tool */}
              <div className="relative inline-block overflow-hidden rounded-lg" ref={wrapRef}>
                <img src={srcUrl} alt="" className="block max-w-full" style={{ maxHeight: '60vh' }} draggable={false} />
                <div className="absolute inset-0 pointer-events-none">
                  <div
                    className="absolute border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.45)] cursor-move pointer-events-auto"
                    style={{ left: cropBox.left, top: cropBox.top, width: cropBox.w, height: cropBox.h, touchAction: 'none' }}
                    onPointerDown={onPointerDown}
                  >
                    <div className="absolute inset-0 grid grid-cols-3 grid-rows-3">
                      {Array.from({ length: 9 }).map((_, i) => (
                        <div key={i} className="border border-white/30" />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </Card>
            <div className="flex flex-wrap gap-2 mt-4">
              <Button onClick={download}><Download size={15} /> Download PNG</Button>
              <Button variant="secondary" onClick={copy}><Copy size={14} /> Copy</Button>
              <Button variant="secondary" onClick={reset}><RotateCcw size={14} /> New</Button>
            </div>
          </div>

          <Card className="p-5 space-y-5">
            <div>
              <Label hint="Instagram only supports these four sizes — your export lands on the exact pixel dimensions shown.">
                Instagram size
              </Label>
              <SegGroup
                options={PRESETS.map((p) => ({ label: p.label, value: p.id, hint: p.hint }))}
                value={presetId}
                onChange={setPresetId}
                columns={2}
              />
            </div>
            <Slider
              label="Crop size"
              value={zoom}
              min={20}
              max={100}
              onChange={setZoom}
              suffix="%"
              hint="How much of the image the crop box covers. Smaller means a tighter crop."
            />
            <div className="space-y-1">
              <div className="text-2xs font-semibold text-gray-700 tabular-nums">
                Exports at {preset.w} × {preset.h}px
              </div>
              <div className="text-2xs text-gray-400 tabular-nums">
                From a {Math.round(srcCrop.w) || 0} × {Math.round(srcCrop.h) || 0}px crop
              </div>
              {upscaling && (
                <div className="text-2xs text-amber-600 leading-snug">
                  This crop is smaller than {preset.w}px wide, so it will be scaled up and may look soft. Try a larger
                  crop size or a bigger source image.
                </div>
              )}
            </div>
          </Card>
        </div>
      )}
      <Toast toast={toast} onDone={clear} />
    </>
  )
}
