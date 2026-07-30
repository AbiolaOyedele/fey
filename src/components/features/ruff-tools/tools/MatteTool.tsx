'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { Download, RotateCcw } from 'lucide-react'
import Dropzone from '@/components/features/ruff-tools/Dropzone'
import Toast from '@/components/features/ruff-tools/Toast'
import { Card, Label, Button, Slider, SegGroup, ColorField } from '@/components/features/ruff-tools/ui'
import { useToast, usePaste } from '@/components/features/ruff-tools/hooks'
import { loadImage, canvasToBlob, downloadBlob, stem } from '@/utils/ruffImage'

const SIZES = [
  { label: '1080²', value: 1080 },
  { label: '1200²', value: 1200 },
  { label: '2048²', value: 2048 },
]
type Position = 'center' | 'top' | 'bottom'
const POSITIONS = [
  { label: 'Center', value: 'center' as const },
  { label: 'Top', value: 'top' as const },
  { label: 'Bottom', value: 'bottom' as const },
]

/** Matte Generator — centres an image on a solid square canvas for feeds. */
export default function MatteTool() {
  const { toast, success, error, clear } = useToast()
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  const [fileName, setFileName] = useState('')
  const [color, setColor] = useState('#ffffff')
  const [size, setSize] = useState(1080)
  const [padding, setPadding] = useState(8)
  const [position, setPosition] = useState<Position>('center')
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const onFiles = useCallback(async (files: File[]) => {
    const file = files[0]
    if (!file) return
    try {
      const image = await loadImage(file)
      setImg(image)
      setFileName(stem(file.name))
      success(`Loaded ${file.name} — ${image.naturalWidth} × ${image.naturalHeight}px`)
    } catch (e) {
      error(e instanceof Error ? e.message : 'That image could not be opened')
    }
  }, [success, error])

  usePaste((file) => onFiles([file]), !img)

  useEffect(() => {
    const c = canvasRef.current
    if (!c || !img) return
    c.width = size
    c.height = size
    const ctx = c.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = color
    ctx.fillRect(0, 0, size, size)

    const pad = (padding / 100) * size
    const avail = size - pad * 2
    const scale = Math.min(avail / img.naturalWidth, avail / img.naturalHeight)
    const w = img.naturalWidth * scale
    const h = img.naturalHeight * scale
    const x = (size - w) / 2
    let y: number
    if (position === 'top') y = pad
    else if (position === 'bottom') y = size - pad - h
    else y = (size - h) / 2
    ctx.drawImage(img, x, y, w, h)
  }, [img, color, size, padding, position])

  const download = async () => {
    if (!canvasRef.current) return
    try {
      const blob = await canvasToBlob(canvasRef.current)
      downloadBlob(blob, `${fileName || 'matte'}_matte.png`)
      success(`Downloaded at ${size} × ${size}px`)
    } catch {
      error('That image could not be exported — try a smaller canvas size')
    }
  }

  const reset = () => { setImg(null); setFileName('') }

  return (
    <>
      {!img ? (
        <div className="max-w-xl mx-auto">
          <Dropzone onFiles={onFiles} label="Drop image here" sub="or click to select, or paste" />
        </div>
      ) : (
        <div className="grid lg:grid-cols-[1fr_300px] gap-6 items-start">
          <div>
            <Label>Preview</Label>
            <Card className="p-4 flex items-center justify-center">
              <canvas
                ref={canvasRef}
                className="max-w-full rounded-lg shadow-sm"
                style={{ maxHeight: '60vh', width: 'auto', aspectRatio: '1 / 1' }}
              />
            </Card>
            <div className="flex flex-wrap gap-2 mt-4">
              <Button onClick={download}><Download size={15} /> Download PNG</Button>
              <Button variant="secondary" onClick={reset}><RotateCcw size={14} /> New image</Button>
            </div>
          </div>

          <Card className="p-5 space-y-5">
            <div>
              <Label>Canvas size</Label>
              <SegGroup options={SIZES} value={size} onChange={setSize} />
            </div>
            <div>
              <Label>Position</Label>
              <SegGroup options={POSITIONS} value={position} onChange={setPosition} />
            </div>
            <Slider label="Padding" value={padding} min={0} max={30} onChange={setPadding} suffix="%" />
            <div>
              <Label>Matte colour</Label>
              <ColorField label="Background" value={color} onChange={setColor} />
            </div>
          </Card>
        </div>
      )}
      <Toast toast={toast} onDone={clear} />
    </>
  )
}
