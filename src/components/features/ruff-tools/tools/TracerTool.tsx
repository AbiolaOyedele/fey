'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import ImageTracer from 'imagetracerjs'
import { Download, Copy, RotateCcw } from 'lucide-react'
import Dropzone from '@/components/features/ruff-tools/Dropzone'
import Toast from '@/components/features/ruff-tools/Toast'
import { Card, Label, Button, Slider, SegGroup, InlineSpinner } from '@/components/features/ruff-tools/ui'
import { useToast, usePaste } from '@/components/features/ruff-tools/hooks'
import { loadImage, downloadBlob, stem, prettyBytes } from '@/utils/ruffImage'

/**
 * imagetracerjs outputs an <svg> with a fixed pixel width/height and no viewBox,
 * which collapses inside a flex container. Convert it to a responsive SVG.
 */
function makeResponsive(svg: string): string {
  const w = svg.match(/width="([\d.]+)"/)?.[1]
  const h = svg.match(/height="([\d.]+)"/)?.[1]
  if (!w || !h) return svg
  return svg
    .replace(/(<svg[^>]*?)\s+width="[\d.]+"/, '$1')
    .replace(/(<svg[^>]*?)\s+height="[\d.]+"/, '$1')
    .replace(/<svg/, `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet"`)
}

/** Image Tracer — convert a photo or logo into a scalable SVG vector. */
export default function TracerTool() {
  const { toast, success, error, clear } = useToast()
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  const [name, setName] = useState('')
  const [origUrl, setOrigUrl] = useState<string | null>(null)
  const [colors, setColors] = useState(16)
  const [detail, setDetail] = useState(50)
  const [invert, setInvert] = useState(false)
  const [view, setView] = useState('svg')
  const [svg, setSvg] = useState('')
  const [busy, setBusy] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const onFiles = useCallback(async (files: File[]) => {
    const f = files[0]; if (!f) return
    try {
      const image = await loadImage(f)
      setImg(image); setName(stem(f.name))
      setOrigUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(f) })
      success(`Loaded ${f.name} — tracing now`)
    } catch (e) {
      error(e instanceof Error ? e.message : 'That image could not be opened')
    }
  }, [success, error])

  usePaste((file) => onFiles([file]), !img)

  useEffect(() => {
    if (!img) return
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      setBusy(true)
      try {
        const maxDim = 700
        const scale = Math.min(maxDim / img.naturalWidth, maxDim / img.naturalHeight, 1)
        const w = Math.round(img.naturalWidth * scale)
        const h = Math.round(img.naturalHeight * scale)
        const canvas = document.createElement('canvas')
        canvas.width = w; canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        ctx.drawImage(img, 0, 0, w, h)
        const imageData = ctx.getImageData(0, 0, w, h)
        if (invert) {
          const d = imageData.data
          for (let i = 0; i < d.length; i += 4) {
            d[i] = 255 - d[i]; d[i + 1] = 255 - d[i + 1]; d[i + 2] = 255 - d[i + 2]
          }
        }
        const res = 4 - (detail / 100) * 3.8
        const out = ImageTracer.imagedataToSVG(imageData, {
          numberofcolors: colors,
          ltres: res,
          qtres: res,
          pathomit: Math.round(8 - (detail / 100) * 7),
          scale: 1 / scale,
        })
        setSvg(makeResponsive(out))
      } catch {
        error('That image could not be traced — try fewer colour levels')
      } finally {
        setBusy(false)
      }
    }, 280)
    return () => clearTimeout(timer.current)
  }, [img, colors, detail, invert]) // eslint-disable-line react-hooks/exhaustive-deps

  const downloadSvg = () => {
    try {
      downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), `${name || 'traced'}.svg`)
      success(`SVG saved to your downloads — ${prettyBytes(new Blob([svg]).size)}`)
    } catch {
      error('That SVG could not be exported')
    }
  }
  const copySvg = async () => {
    try {
      await navigator.clipboard.writeText(svg)
      success('SVG markup copied to your clipboard')
    } catch {
      error('Your browser blocked the clipboard — use Download instead')
    }
  }
  const reset = () => {
    setImg(null); setSvg(''); setName('')
    setOrigUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return null })
  }

  return (
    <>
      {!img || !origUrl ? (
        <div className="max-w-xl mx-auto">
          <Dropzone onFiles={onFiles} label="Drop an image here" sub="or click to select, or paste — PNG, JPG, WebP, GIF" />
        </div>
      ) : (
        <div className="grid lg:grid-cols-[1fr_280px] gap-6 items-start">
          <div>
            <div className="flex items-center justify-between mb-2 gap-2">
              <Label className="!mb-0">Preview</Label>
              <SegGroup
                options={[{ label: 'SVG', value: 'svg' }, { label: 'Original', value: 'original' }]}
                value={view}
                onChange={setView}
              />
            </div>
            <Card className="p-4 flex items-center justify-center min-h-[320px] relative">
              {busy && <div className="absolute top-3 right-3 z-10"><InlineSpinner text="Tracing…" /></div>}
              {view === 'original' ? (
                <img src={origUrl} alt="original" className="max-w-full rounded-lg" style={{ maxHeight: '60vh' }} />
              ) : (
                <div
                  className="w-full max-h-[60vh] overflow-auto [&>svg]:w-full [&>svg]:h-auto [&>svg]:rounded-lg"
                  dangerouslySetInnerHTML={{ __html: svg }}
                />
              )}
            </Card>
            <div className="flex flex-wrap gap-2 mt-4">
              <Button onClick={downloadSvg} disabled={!svg}><Download size={15} /> Download SVG</Button>
              <Button variant="secondary" onClick={copySvg} disabled={!svg}><Copy size={14} /> Copy SVG</Button>
              <Button variant="secondary" onClick={reset}><RotateCcw size={14} /> New</Button>
            </div>
          </div>

          <Card className="p-5 space-y-5">
            <Slider label="Colour levels" value={colors} min={2} max={64} onChange={setColors} />
            <Slider label="Detail" value={detail} min={0} max={100} onChange={setDetail} suffix="%" />
            <div>
              <Label>Invert</Label>
              <SegGroup
                options={[{ label: 'Off', value: false }, { label: 'On', value: true }]}
                value={invert}
                onChange={setInvert}
              />
            </div>
            <p className="text-2xs text-gray-400 font-medium leading-relaxed">
              Fewer colours and lower detail give smaller, cleaner SVGs. Higher detail traces more faithfully but produces larger files.
            </p>
          </Card>
        </div>
      )}
      <Toast toast={toast} onDone={clear} />
    </>
  )
}
