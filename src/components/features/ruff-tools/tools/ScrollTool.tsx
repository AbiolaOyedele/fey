'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { Download, RotateCcw, Package } from 'lucide-react'
import JSZip from 'jszip'
import Dropzone from '@/components/features/ruff-tools/Dropzone'
import Toast from '@/components/features/ruff-tools/Toast'
import { Card, Label, Button, Slider, SegGroup, NumberField } from '@/components/features/ruff-tools/ui'
import { useToast, usePaste } from '@/components/features/ruff-tools/hooks'
import { loadImage, canvasToBlob, downloadBlob, stem } from '@/utils/ruffImage'
import type { RuffToolProps } from '@/types/ruffTool'

const RATIOS = [
  { label: 'Square 1:1', value: 1, hint: 'Every slide is square — 1:1' },
  { label: 'Portrait 4:5', value: 0.8, hint: 'Every slide is 4:5, the tallest Instagram allows' },
  { label: 'Source', value: 0, hint: 'Keeps the image height and splits it evenly' },
]

const MIN_SLIDES = 2
const MAX_SLIDES = 15

interface Tile { url: string; blob: Blob; name: string; w: number; h: number }

/**
 * Geometry for one carousel: the source rectangle each slide is cut from, and
 * the pixel size it exports at.
 *
 * Slides always stay edge-to-edge so the carousel reads as one continuous
 * image. Whichever way the chosen ratio pulls, one axis has to give:
 * a ratio narrower than an even split keeps full height and trims the far ends
 * of the panorama; a wider ratio keeps full width and trims top and bottom.
 */
function geometry(img: HTMLImageElement, slides: number, ratio: number) {
  const W = img.naturalWidth
  const H = img.naturalHeight
  const stripW = W / slides
  const target = ratio === 0 ? stripW / H : ratio

  const narrower = target <= stripW / H
  const regionH = narrower ? H : stripW / target
  const regionW = narrower ? H * target : stripW

  const outH = Math.max(1, Math.round(regionH))
  const outW = Math.max(1, Math.round(outH * target))

  return {
    regionW,
    regionH,
    outW,
    outH,
    /** Left edge of the whole slide band — centred in the source image. */
    x0: (W - regionW * slides) / 2,
    y0: (H - regionH) / 2,
  }
}

/** Seamless Scroll — slice a panorama into equal carousel slides. */
export default function ScrollTool({ accent }: RuffToolProps) {
  const { toast, success, error, clear } = useToast()
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  const [name, setName] = useState('')
  const [slides, setSlides] = useState(3)
  const [ratio, setRatio] = useState(0.8)
  const [tiles, setTiles] = useState<Tile[]>([])
  const [busy, setBusy] = useState(false)
  const overlayRef = useRef<HTMLCanvasElement>(null)

  /** Drops any generated slides and frees their object URLs. */
  const clearTiles = useCallback(() => {
    setTiles((prev) => { prev.forEach((t) => URL.revokeObjectURL(t.url)); return [] })
  }, [])

  const onFiles = useCallback(async (files: File[]) => {
    const f = files[0]; if (!f) return
    try {
      const image = await loadImage(f)
      setImg(image); setName(stem(f.name)); clearTiles()
      success(`Loaded ${f.name} — ${image.naturalWidth} × ${image.naturalHeight}px`)
    } catch (e) {
      error(e instanceof Error ? e.message : 'That image could not be opened')
    }
  }, [success, error, clearTiles])

  usePaste((file) => onFiles([file]), !img)

  // Split preview: shows the exact slide band for the chosen ratio, with the
  // trimmed edges dimmed and dashed lines on every seam.
  useEffect(() => {
    const c = overlayRef.current
    if (!c || !img) return
    const maxW = 620
    const scale = Math.min(maxW / img.naturalWidth, 1)
    c.width = Math.round(img.naturalWidth * scale)
    c.height = Math.round(img.naturalHeight * scale)
    const ctx = c.getContext('2d')
    if (!ctx) return

    const g = geometry(img, slides, ratio)
    const bx = g.x0 * scale
    const by = g.y0 * scale
    const bw = g.regionW * slides * scale
    const bh = g.regionH * scale

    ctx.clearRect(0, 0, c.width, c.height)
    ctx.drawImage(img, 0, 0, c.width, c.height)

    // Dim whatever falls outside the slide band.
    ctx.fillStyle = 'rgba(17,17,17,0.55)'
    if (by > 0.5) {
      ctx.fillRect(0, 0, c.width, by)
      ctx.fillRect(0, by + bh, c.width, c.height - (by + bh))
    }
    if (bx > 0.5) {
      ctx.fillRect(0, by, bx, bh)
      ctx.fillRect(bx + bw, by, c.width - (bx + bw), bh)
    }

    ctx.strokeStyle = accent
    ctx.lineWidth = 1.5
    ctx.setLineDash([6, 4])
    for (let i = 1; i < slides; i++) {
      const x = bx + (bw / slides) * i
      ctx.beginPath(); ctx.moveTo(x, by); ctx.lineTo(x, by + bh); ctx.stroke()
    }
    ctx.setLineDash([])
    ctx.strokeRect(bx + 0.75, by + 0.75, bw - 1.5, bh - 1.5)
  }, [img, slides, ratio, accent])

  const generate = async () => {
    if (!img) return
    setBusy(true)
    try {
      const g = geometry(img, slides, ratio)
      const out: Tile[] = []
      for (let i = 0; i < slides; i++) {
        const canvas = document.createElement('canvas')
        canvas.width = g.outW
        canvas.height = g.outH
        const ctx = canvas.getContext('2d')
        if (!ctx) continue
        ctx.imageSmoothingQuality = 'high'
        ctx.drawImage(
          img,
          g.x0 + i * g.regionW, g.y0, g.regionW, g.regionH,
          0, 0, g.outW, g.outH,
        )
        const blob = await canvasToBlob(canvas)
        out.push({
          url: URL.createObjectURL(blob),
          blob,
          name: `${name}_${String(i + 1).padStart(2, '0')}.png`,
          w: g.outW,
          h: g.outH,
        })
      }
      clearTiles()
      setTiles(out)
      success(`${out.length} slides ready at ${g.outW} × ${g.outH}px`)
    } catch (e) {
      error(e instanceof Error ? e.message : 'Those slides could not be generated')
    } finally {
      setBusy(false)
    }
  }

  const downloadZip = async () => {
    try {
      const zip = new JSZip()
      tiles.forEach((t) => zip.file(t.name, t.blob))
      const blob = await zip.generateAsync({ type: 'blob' })
      downloadBlob(blob, `${name || 'carousel'}.zip`)
      success(`${tiles.length} slides downloaded as a ZIP`)
    } catch {
      error('The ZIP could not be built — try downloading slides one by one')
    }
  }

  const reset = () => { setImg(null); clearTiles(); setName('') }

  const geo = img ? geometry(img, slides, ratio) : null

  return (
    <>
      {!img ? (
        <div className="max-w-xl mx-auto">
          <Dropzone onFiles={onFiles} label="Drop a panoramic image here" sub="or click to select, or paste — wide images work best" />
        </div>
      ) : (
        <div className="grid lg:grid-cols-[1fr_280px] gap-6 items-start">
          {/* min-w-0 lets the slide strip scroll inside the column instead of
              stretching it past the viewport on narrow screens */}
          <div className="min-w-0">
            <Label>{tiles.length ? 'Carousel slides, swipe order →' : 'Split preview — dimmed areas are trimmed'}</Label>
            {tiles.length === 0 ? (
              <Card className="p-4 flex items-center justify-center overflow-x-auto">
                <canvas ref={overlayRef} className="max-w-full rounded-lg" />
              </Card>
            ) : (
              <div className="flex gap-1.5 overflow-x-auto pb-2">
                {tiles.map((t, i) => (
                  <div key={t.name} className="relative group flex-shrink-0" style={{ width: 150 }}>
                    <img src={t.url} alt={t.name} className="w-full rounded-lg border border-gray-200 object-cover" style={{ aspectRatio: `${t.w} / ${t.h}` }} />
                    <span className="absolute top-1.5 left-1.5 text-white text-3xs font-semibold w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: accent }}>{i + 1}</span>
                    <a
                      href={t.url}
                      download={t.name}
                      onClick={() => success(`Slide ${i + 1} downloaded`)}
                      className="absolute inset-0 bg-black/0 group-hover:bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all rounded-lg"
                    >
                      <Download size={16} className="text-white" />
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Card className="p-5 space-y-5">
            <Slider
              label="Slides"
              value={slides}
              min={MIN_SLIDES}
              max={MAX_SLIDES}
              onChange={(v) => { setSlides(v); clearTiles() }}
              hint={`How many panels the carousel is split into — anything from ${MIN_SLIDES} to ${MAX_SLIDES}. Type an exact number in the box.`}
              control={
                <NumberField
                  label="Number of slides"
                  value={slides}
                  min={MIN_SLIDES}
                  max={MAX_SLIDES}
                  onChange={(v) => { setSlides(v); clearTiles() }}
                />
              }
            />
            <div>
              <Label hint="The shape of each slide. Slides stay edge-to-edge, so the ratio decides whether the ends or the top and bottom get trimmed.">
                Slide ratio
              </Label>
              <SegGroup options={RATIOS} value={ratio} onChange={(v) => { setRatio(v); clearTiles() }} />
            </div>
            {geo && (
              <div className="text-2xs text-gray-400 tabular-nums leading-relaxed">
                {slides} slides at {geo.outW} × {geo.outH}px
              </div>
            )}
            <div className="space-y-2 pt-1">
              {tiles.length === 0 ? (
                <Button className="w-full" onClick={generate} disabled={busy}>
                  {busy ? 'Generating…' : `Generate ${slides} slides`}
                </Button>
              ) : (
                <Button className="w-full" onClick={downloadZip}><Package size={15} /> Download ZIP</Button>
              )}
              <Button variant="secondary" className="w-full" onClick={reset}><RotateCcw size={14} /> New image</Button>
            </div>
          </Card>
        </div>
      )}
      <Toast toast={toast} onDone={clear} />
    </>
  )
}
