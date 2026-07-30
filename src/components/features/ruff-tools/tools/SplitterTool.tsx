'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { Download, RotateCcw, Package } from 'lucide-react'
import JSZip from 'jszip'
import Dropzone from '@/components/features/ruff-tools/Dropzone'
import Toast from '@/components/features/ruff-tools/Toast'
import { Card, Label, Button, Slider } from '@/components/features/ruff-tools/ui'
import { useToast, usePaste } from '@/components/features/ruff-tools/hooks'
import { loadImage, canvasToBlob, downloadBlob, stem } from '@/utils/ruffImage'
import type { RuffToolProps } from '@/types/ruffTool'

interface Tile { url: string; blob: Blob; name: string }

/** Image Splitter — cut an image into an equal grid, download as a ZIP. */
export default function SplitterTool({ accent }: RuffToolProps) {
  const { toast, success, error, clear } = useToast()
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  const [name, setName] = useState('')
  const [rows, setRows] = useState(2)
  const [cols, setCols] = useState(2)
  const [tiles, setTiles] = useState<Tile[]>([])
  const [busy, setBusy] = useState(false)
  const overlayRef = useRef<HTMLCanvasElement>(null)

  const onFiles = useCallback(async (files: File[]) => {
    const f = files[0]; if (!f) return
    try {
      const image = await loadImage(f)
      setImg(image); setName(stem(f.name)); setTiles([])
      success(`Loaded ${f.name} — ${image.naturalWidth} × ${image.naturalHeight}px`)
    } catch (e) {
      error(e instanceof Error ? e.message : 'That image could not be opened')
    }
  }, [success, error])

  usePaste((file) => onFiles([file]), !img)

  useEffect(() => {
    const c = overlayRef.current
    if (!c || !img) return
    const maxW = 560
    const scale = Math.min(maxW / img.naturalWidth, 1)
    c.width = img.naturalWidth * scale
    c.height = img.naturalHeight * scale
    const ctx = c.getContext('2d')
    if (!ctx) return
    ctx.drawImage(img, 0, 0, c.width, c.height)
    ctx.strokeStyle = accent
    ctx.lineWidth = 1.5
    for (let i = 1; i < cols; i++) {
      const x = (c.width / cols) * i
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, c.height); ctx.stroke()
    }
    for (let i = 1; i < rows; i++) {
      const y = (c.height / rows) * i
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(c.width, y); ctx.stroke()
    }
  }, [img, rows, cols, accent])

  const split = async () => {
    if (!img) return
    setBusy(true)
    try {
      const tw = Math.floor(img.naturalWidth / cols)
      const th = Math.floor(img.naturalHeight / rows)
      const out: Tile[] = []
      for (let r = 0; r < rows; r++) {
        for (let cc = 0; cc < cols; cc++) {
          const canvas = document.createElement('canvas')
          canvas.width = tw
          canvas.height = th
          canvas.getContext('2d')?.drawImage(img, cc * tw, r * th, tw, th, 0, 0, tw, th)
          const blob = await canvasToBlob(canvas)
          out.push({ url: URL.createObjectURL(blob), blob, name: `${name}_r${r + 1}c${cc + 1}.png` })
        }
      }
      setTiles(out)
      success(`${out.length} tiles ready at ${tw} × ${th}px each`)
    } catch (e) {
      error(e instanceof Error ? e.message : 'That image could not be split')
    } finally {
      setBusy(false)
    }
  }

  const downloadZip = async () => {
    try {
      const zip = new JSZip()
      tiles.forEach((t) => zip.file(t.name, t.blob))
      const blob = await zip.generateAsync({ type: 'blob' })
      downloadBlob(blob, `${name || 'tiles'}.zip`)
      success(`${tiles.length} tiles downloaded as a ZIP`)
    } catch {
      error('The ZIP could not be built — try downloading tiles one by one')
    }
  }

  const reset = () => { setImg(null); setTiles([]); setName('') }

  return (
    <>
      {!img ? (
        <div className="max-w-xl mx-auto">
          <Dropzone onFiles={onFiles} label="Drop image here" sub="PNG, JPG, or any image format, or paste" />
        </div>
      ) : (
        <div className="grid lg:grid-cols-[1fr_280px] gap-6 items-start">
          <div>
            <Label>{tiles.length ? `${tiles.length} tiles` : 'Grid preview'}</Label>
            {tiles.length === 0 ? (
              <Card className="p-4 flex items-center justify-center">
                <canvas ref={overlayRef} className="max-w-full rounded-lg" />
              </Card>
            ) : (
              <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}>
                {tiles.map((t) => (
                  <div key={t.name} className="rounded-lg overflow-hidden border border-gray-200 relative group">
                    <img src={t.url} alt={t.name} className="w-full object-cover aspect-square" />
                    <a href={t.url} download={t.name}
                      onClick={() => success(`${t.name} downloaded`)}
                      className="absolute inset-0 bg-black/0 group-hover:bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all">
                      <Download size={16} className="text-white" />
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Card className="p-5 space-y-5">
            <Slider label="Columns" value={cols} min={1} max={10} onChange={(v) => { setCols(v); setTiles([]) }} />
            <Slider label="Rows" value={rows} min={1} max={10} onChange={(v) => { setRows(v); setTiles([]) }} />
            <div className="text-2xs text-gray-400 font-medium">
              {rows * cols} tiles · ~{Math.floor(img.naturalWidth / cols)}×{Math.floor(img.naturalHeight / rows)}px each
            </div>
            <div className="space-y-2 pt-1">
              {tiles.length === 0 ? (
                <Button className="w-full" onClick={split} disabled={busy}>
                  {busy ? 'Splitting…' : `Split into ${rows * cols} tiles`}
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
