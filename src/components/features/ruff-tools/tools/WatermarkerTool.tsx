'use client'

import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { Download, RotateCcw, Save, Trash2, Loader2, Check } from 'lucide-react'
import Dropzone from '@/components/features/ruff-tools/Dropzone'
import Toast from '@/components/features/ruff-tools/Toast'
import { Card, Label, Button, Slider, SegGroup } from '@/components/features/ruff-tools/ui'
import { useToast } from '@/components/features/ruff-tools/hooks'
import { useWorkspace } from '@/hooks/useWorkspace'
import { useWatermarks } from '@/hooks/useWatermarks'
import { loadImage, canvasToBlob, downloadBlob, stem, keyOutBackground, CHECKER } from '@/utils/ruffImage'
import type { RuffToolProps, Watermark } from '@/types/ruffTool'

const POSITIONS = ['tl', 'tm', 'tr', 'ml', 'mm', 'mr', 'bl', 'bm', 'br'] as const

/** Watermarker — overlay a logo/watermark, with a synced reusable library. */
export default function WatermarkerTool({ accent }: RuffToolProps) {
  const { toast, success, error, clear } = useToast()
  const { workspace } = useWorkspace()
  const { watermarks, loading: wmLoading, saveWatermark, removeWatermark } = useWatermarks(workspace?.id ?? null)

  const [base, setBase] = useState<HTMLImageElement | null>(null)
  const [mark, setMark] = useState<HTMLImageElement | null>(null)
  const [markFile, setMarkFile] = useState<File | null>(null)
  const [baseName, setBaseName] = useState('')
  const [position, setPosition] = useState('br')
  const [opacity, setOpacity] = useState(80)
  const [scale, setScale] = useState(25)
  const [margin, setMargin] = useState(4)
  const [tile, setTile] = useState('single')
  const [bgMode, setBgMode] = useState('keep')
  const [bgTolerance, setBgTolerance] = useState(15)
  const [saveName, setSaveName] = useState('')
  const [saving, setSaving] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  /**
   * The watermark actually painted onto the base image — either the upload as-is
   * or a copy with its flat background keyed out. Cross-origin saved watermarks
   * can't be read pixel-by-pixel, so that case falls back to the original and
   * says so in the panel.
   */
  const stamp = useMemo<{ source: HTMLImageElement | HTMLCanvasElement | null; unreadable: boolean }>(() => {
    if (!mark) return { source: null, unreadable: false }
    if (bgMode !== 'remove') return { source: mark, unreadable: false }
    try {
      return { source: keyOutBackground(mark, bgTolerance), unreadable: false }
    } catch {
      return { source: mark, unreadable: true }
    }
  }, [mark, bgMode, bgTolerance])

  const loadBase = useCallback(async (files: File[]) => {
    const f = files[0]; if (!f) return
    try {
      const image = await loadImage(f)
      setBase(image); setBaseName(stem(f.name))
      success(`Loaded ${f.name} — ${image.naturalWidth} × ${image.naturalHeight}px`)
    } catch (e) {
      error(e instanceof Error ? e.message : 'That image could not be opened')
    }
  }, [success, error])

  const loadMark = useCallback(async (files: File[]) => {
    const f = files[0]; if (!f) return
    try {
      setMark(await loadImage(f)); setMarkFile(f); setSaveName(stem(f.name))
      success('Watermark added')
    } catch (e) {
      error(e instanceof Error ? e.message : 'That watermark could not be opened')
    }
  }, [success, error])

  const applySaved = useCallback(async (w: Watermark) => {
    try {
      setMark(await loadImage(w.image_url)); setMarkFile(null); setSaveName('')
      success(`Using “${w.name}”`)
    } catch {
      error('That saved watermark could not be loaded')
    }
  }, [success, error])

  const saveCurrent = async () => {
    if (!markFile) return
    setSaving(true)
    try {
      const saved = await saveWatermark(markFile, saveName)
      setMarkFile(null) // saved — no longer a fresh upload
      success(`“${saved.name}” saved to your library`)
    } catch (e) {
      error(e instanceof Error ? e.message : 'That watermark could not be saved')
    } finally {
      setSaving(false)
    }
  }

  const deleteSaved = async (w: Watermark) => {
    try {
      await removeWatermark(w.id)
      success(`“${w.name}” removed from your library`)
    } catch (e) {
      error(e instanceof Error ? e.message : 'That watermark could not be removed')
    }
  }

  useEffect(() => {
    const c = canvasRef.current
    if (!c || !base) return
    c.width = base.naturalWidth
    c.height = base.naturalHeight
    const ctx = c.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, c.width, c.height)
    ctx.drawImage(base, 0, 0)
    const src = stamp.source
    if (!src) return

    const srcW = src instanceof HTMLCanvasElement ? src.width : src.naturalWidth
    const srcH = src instanceof HTMLCanvasElement ? src.height : src.naturalHeight
    if (!srcW || !srcH) return

    const mw = (scale / 100) * c.width
    const mh = mw * (srcH / srcW)
    const mg = (margin / 100) * c.width
    ctx.globalAlpha = opacity / 100

    if (tile === 'tile') {
      const gapX = mw + mg * 2
      const gapY = mh + mg * 2
      for (let y = mg; y < c.height; y += gapY)
        for (let x = mg; x < c.width; x += gapX)
          ctx.drawImage(src, x, y, mw, mh)
    } else {
      const v = position[0], h = position[1]
      let x = (c.width - mw) / 2, y = (c.height - mh) / 2
      if (h === 'l') x = mg
      if (h === 'r') x = c.width - mw - mg
      if (v === 't') y = mg
      if (v === 'b') y = c.height - mh - mg
      ctx.drawImage(src, x, y, mw, mh)
    }
    ctx.globalAlpha = 1
  }, [base, stamp, position, opacity, scale, margin, tile])

  const download = async () => {
    if (!canvasRef.current) return
    try {
      const blob = await canvasToBlob(canvasRef.current)
      downloadBlob(blob, `${baseName || 'image'}_watermarked.png`)
      success('Watermarked image saved to your downloads')
    } catch {
      error('Export failed — re-upload the watermark file and try again')
    }
  }

  const reset = () => { setBase(null); setMark(null); setMarkFile(null); setBaseName('') }

  const savedLibrary = (
    <div>
      <Label>Saved watermarks</Label>
      {wmLoading ? (
        <div className="flex items-center gap-2 text-2xs text-gray-400 py-2"><Loader2 size={13} className="animate-spin" /> Loading…</div>
      ) : watermarks.length === 0 ? (
        <p className="text-2xs text-gray-400">None yet — upload one and save it to reuse later.</p>
      ) : (
        <div className="grid grid-cols-4 gap-1.5">
          {watermarks.map((w) => (
            <div key={w.id} className="relative group">
              <button
                onClick={() => applySaved(w)}
                title={`Use "${w.name}"`}
                className="w-full aspect-square rounded-lg border border-gray-200 overflow-hidden hover:border-gray-300 transition-colors p-1"
                style={CHECKER}
              >
                <img src={w.image_url} alt={w.name} className="w-full h-full object-contain" />
              </button>
              <button
                onClick={() => deleteSaved(w)}
                title={`Delete "${w.name}"`}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 size={11} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  return (
    <>
      {!base ? (
        <div className="max-w-2xl mx-auto space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label>Base image</Label>
              <Dropzone onFiles={loadBase} label="Drop image here" sub="or click to select" />
            </div>
            <div>
              <Label>Watermark</Label>
              <Dropzone accept="image/png" onFiles={loadMark} label="Drop watermark here" sub="transparent PNG works best" />
            </div>
          </div>
          <Card className="p-4">{savedLibrary}</Card>
        </div>
      ) : (
        <div className="grid lg:grid-cols-[1fr_300px] gap-6 items-start">
          <div>
            <Label>Preview</Label>
            {/* Pale pink surface behind the canvas so a white or transparent
                image is easy to tell apart from the preview background */}
            <Card className="p-4">
              <div className="bg-pink-50 rounded-xl p-3 sm:p-4 flex items-center justify-center">
                <canvas ref={canvasRef} className="max-w-full rounded-lg" style={{ maxHeight: '60vh', width: 'auto' }} />
              </div>
            </Card>
            <div className="flex flex-wrap gap-2 mt-4">
              <Button onClick={download} disabled={!mark}><Download size={15} /> Download PNG</Button>
              <Button variant="secondary" onClick={reset}><RotateCcw size={14} /> Start over</Button>
            </div>
          </div>

          <Card className="p-5 space-y-5">
            {!mark ? (
              <div>
                <Label>Watermark (PNG)</Label>
                <Dropzone accept="image/png" onFiles={loadMark} label="Drop watermark" sub="transparent PNG" />
              </div>
            ) : markFile ? (
              <div>
                <Label>Save this watermark</Label>
                <div className="flex items-center gap-2">
                  <input
                    value={saveName}
                    onChange={(e) => setSaveName(e.target.value)}
                    placeholder="Name it…"
                    className="flex-1 min-w-0 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs2 text-gray-700 outline-none focus:border-gray-300"
                  />
                  <Button onClick={saveCurrent} disabled={saving} className="!px-3">
                    {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                  </Button>
                </div>
                <p className="text-3xs text-gray-400 mt-1">Reuse it later without re-uploading.</p>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-2xs font-medium" style={{ color: accent }}>
                <Check size={13} /> Using a saved watermark
              </div>
            )}

            {mark && (
              <div>
                <Label hint="Clears the flat colour behind your watermark — handy for a logo saved on a white background.">
                  Watermark background
                </Label>
                <SegGroup
                  options={[
                    { label: 'Keep', value: 'keep', hint: 'Leave the watermark exactly as uploaded' },
                    { label: 'Remove', value: 'remove', hint: 'Make the flat background colour transparent' },
                  ]}
                  value={bgMode}
                  onChange={setBgMode}
                />
                {bgMode === 'remove' && (
                  <div className="mt-3">
                    <Slider
                      label="Removal strength"
                      value={bgTolerance}
                      min={2}
                      max={45}
                      onChange={setBgTolerance}
                      suffix="%"
                      hint="Higher clears more shades of the background. Too high starts eating into the logo itself."
                    />
                    {stamp.unreadable && (
                      <p className="text-2xs text-amber-600 leading-snug mt-2">
                        This saved watermark can&apos;t be edited in the browser. Upload the file again to remove its background.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            <div>
              <Label>Pattern</Label>
              <SegGroup options={[{ label: 'Single', value: 'single' }, { label: 'Tile', value: 'tile' }]} value={tile} onChange={setTile} />
            </div>
            {tile === 'single' && (
              <div>
                <Label>Position</Label>
                <div className="grid grid-cols-3 gap-1.5 w-fit">
                  {POSITIONS.map((p) => {
                    const active = position === p
                    return (
                      <button
                        key={p}
                        onClick={() => setPosition(p)}
                        className="w-10 h-10 rounded-lg border transition-colors cursor-pointer"
                        style={active ? { backgroundColor: `var(--accent-fill, ${accent})`, borderColor: 'transparent' } : { backgroundColor: '#fff', borderColor: '#e5e7eb' }}
                        aria-label={p}
                      >
                        <span className={`block w-1.5 h-1.5 rounded-full mx-auto ${active ? 'bg-white' : 'bg-gray-300'}`} />
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
            <Slider label="Opacity" value={opacity} min={0} max={100} onChange={setOpacity} suffix="%" />
            <Slider label="Scale" value={scale} min={5} max={100} onChange={setScale} suffix="%" />
            <Slider label="Margin" value={margin} min={0} max={20} onChange={setMargin} suffix="%" />

            <div className="border-t border-gray-100 pt-4">{savedLibrary}</div>
          </Card>
        </div>
      )}
      <Toast toast={toast} onDone={clear} />
    </>
  )
}
