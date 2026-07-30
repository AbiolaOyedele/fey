'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import {
  Download, RotateCcw, ShieldCheck, Plus, X,
  Image as ImageIcon, Package,
} from 'lucide-react'
import JSZip from 'jszip'
import Dropzone from '@/components/features/ruff-tools/Dropzone'
import Toast from '@/components/features/ruff-tools/Toast'
import { Button } from '@/components/features/ruff-tools/ui'
import { useToast, usePaste } from '@/components/features/ruff-tools/hooks'
import { downloadBlob, stem, CHECKER } from '@/utils/ruffImage'
import type { RuffToolProps } from '@/types/ruffTool'

const MAX_BATCH = 50

// Lazy-load keeps the heavy WASM engine out of the initial bundle.
type ProgressFn = (key: string, current: number, total: number) => void
async function removeBg(file: File, onProgress?: ProgressFn): Promise<Blob> {
  const { removeBackground } = await import('@imgly/background-removal')
  return removeBackground(
    file,
    onProgress ? { model: 'isnet_quint8', progress: onProgress } : { model: 'isnet_quint8' },
  )
}

/* ── before / after comparison slider (single mode) ── */
function Compare({ before, after }: { before: string; after: string }) {
  const [pos, setPos] = useState(50)
  const [width, setWidth] = useState(0)
  const wrapRef = useRef<HTMLDivElement>(null)
  const drag = useRef(false)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const measure = () => setWidth(el.clientWidth)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const move = (clientX: number | undefined) => {
      const rect = wrapRef.current?.getBoundingClientRect()
      if (!rect || clientX == null) return
      setPos(Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100)))
    }
    const onMove = (e: MouseEvent | TouchEvent) => {
      if (!drag.current) return
      const x = 'clientX' in e ? e.clientX : e.touches[0]?.clientX
      move(x)
    }
    const onUp = () => (drag.current = false)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    window.addEventListener('touchmove', onMove)
    window.addEventListener('touchend', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onUp)
    }
  }, [])

  return (
    <div
      ref={wrapRef}
      className="relative select-none rounded-2xl overflow-hidden border border-gray-200 cursor-ew-resize"
      style={{ ...CHECKER, maxHeight: '60vh' }}
      onMouseDown={(e) => { drag.current = true; const r = e.currentTarget.getBoundingClientRect(); setPos(((e.clientX - r.left) / r.width) * 100) }}
    >
      <img src={after} alt="Background removed" className="block w-full object-contain max-h-[60vh]" draggable={false} />
      <div className="absolute inset-0 overflow-hidden" style={{ width: `${pos}%` }}>
        <img
          src={before}
          alt="Original"
          className="block h-full object-contain max-h-[60vh] max-w-none"
          style={{ width: width || '100%' }}
          draggable={false}
        />
      </div>
      <div className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.15)]" style={{ left: `${pos}%` }}>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white shadow-md flex items-center justify-center">
          <span className="text-gray-400 text-3xs font-bold tracking-tighter">◂▸</span>
        </div>
      </div>
      <span className="absolute bottom-2 left-2 bg-black/55 text-white text-3xs font-medium px-2 py-0.5 rounded">Original</span>
      <span className="absolute bottom-2 right-2 bg-black/55 text-white text-3xs font-medium px-2 py-0.5 rounded">Removed</span>
    </div>
  )
}

/* ── small pieces ── */
type Mode = 'single' | 'batch'
type SinglePhase = 'idle' | 'processing' | 'done'
type BatchPhase = 'idle' | 'processing' | 'results'
interface SingleResult { url: string; blob: Blob; name: string }
interface BatchResult { name: string; url: string; blob: Blob }

function ModeToggle({ mode, accent, onSwitch }: { mode: Mode; accent: string; onSwitch: (m: Mode) => void }) {
  return (
    <div className="flex bg-white border border-gray-200 rounded-full p-1 mb-6 max-w-xs mx-auto">
      {(['single', 'batch'] as const).map((m) => {
        const active = mode === m
        return (
          <button
            key={m}
            onClick={() => onSwitch(m)}
            className="flex-1 py-2 rounded-full text-xs2 font-medium transition-all cursor-pointer border-none"
            style={active ? { backgroundColor: accent, color: '#fff' } : { background: 'transparent', color: '#9ca3af' }}
          >
            {m === 'single' ? 'Single image' : `Batch (up to ${MAX_BATCH})`}
          </button>
        )
      })}
    </div>
  )
}

function FileRow({ name, onClear }: { name: string; onClear: () => void }) {
  return (
    <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 text-2xs font-medium text-gray-600">
      <ImageIcon size={13} className="text-gray-400 flex-shrink-0" />
      <span className="truncate flex-1">{name}</span>
      <button onClick={onClear} className="text-gray-400 hover:text-gray-700 transition-colors border-none bg-transparent cursor-pointer p-0.5">
        <X size={12} />
      </button>
    </div>
  )
}

function ResultTile({ r }: { r: BatchResult }) {
  return (
    <div className="rounded-xl overflow-hidden border border-gray-200">
      <div className="w-full aspect-square" style={CHECKER}>
        <img src={r.url} alt={r.name} className="w-full h-full object-contain" />
      </div>
      <div className="flex items-center justify-between px-2.5 py-2 bg-white">
        <span className="text-3xs font-medium text-gray-600 truncate flex-1 mr-2" title={r.name}>{r.name}</span>
        <a href={r.url} download={r.name} className="text-gray-400 hover:text-gray-700 transition-colors flex-shrink-0">
          <Download size={12} />
        </a>
      </div>
    </div>
  )
}

function InfoBox() {
  return (
    <div className="mt-4 flex items-start gap-2.5 bg-white border border-gray-100 rounded-xl px-4 py-3">
      <ShieldCheck size={16} className="text-gray-400 flex-shrink-0 mt-0.5" />
      <p className="text-xs text-gray-500 font-medium leading-relaxed m-0">
        Processing happens entirely in your browser. On first use, a one-time engine
        (about 80–180&nbsp;MB) is downloaded and cached, so later runs are fast.
      </p>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════ */
/** Background Remover — cut out backgrounds locally, single or batch. */
export default function BackgroundRemoverTool({ accent }: RuffToolProps) {
  const { toast, success, error, clear } = useToast()
  const [mode, setMode] = useState<Mode>('single')

  /* single */
  const [phase, setPhase] = useState<SinglePhase>('idle')
  const [progress, setProgress] = useState({ label: 'Loading engine…', pct: 0 })
  const [beforeUrl, setBeforeUrl] = useState<string | null>(null)
  const [result, setResult] = useState<SingleResult | null>(null)

  /* batch */
  const [batchFiles, setBatchFiles] = useState<File[]>([])
  const [batchPhase, setBatchPhase] = useState<BatchPhase>('idle')
  const [batchProgress, setBatchProgress] = useState('')
  const [batchResults, setBatchResults] = useState<BatchResult[]>([])

  const switchMode = (m: Mode) => {
    if (m === mode) return
    setMode(m)
    setPhase('idle'); setBeforeUrl(null); setResult(null)
    setBatchFiles([]); setBatchResults([]); setBatchPhase('idle')
  }

  /* ── single ── */
  const processSingle = useCallback(async (files: File[]) => {
    const file = files[0]
    if (!file) return
    setBeforeUrl(URL.createObjectURL(file))
    setPhase('processing')
    setProgress({ label: 'Loading engine…', pct: 0 })
    try {
      const blob = await removeBg(file, (key, current, total) => {
        const pct = total > 0 ? Math.round((current / total) * 100) : 0
        setProgress({ label: key.includes('fetch') ? `Downloading engine… ${pct}%` : 'Removing background…', pct })
      })
      setResult({ url: URL.createObjectURL(blob), blob, name: `${stem(file.name)}_nobg.png` })
      setPhase('done')
      success('Background removed')
    } catch (e) {
      console.error(e)
      error('The background could not be removed — try a different image')
      setPhase('idle')
    }
  }, [success, error])

  const resetSingle = () => { setPhase('idle'); setBeforeUrl(null); setResult(null) }

  /* ── batch ── */
  const addBatchFiles = (files: File[]) => {
    const remaining = MAX_BATCH - batchFiles.length
    if (remaining <= 0) { error(`This batch is full — ${MAX_BATCH} images is the limit`); return }
    const added = files.slice(0, remaining)
    setBatchFiles((prev) => [...prev, ...added])
    if (files.length > remaining) {
      error(`Only ${remaining} added — ${MAX_BATCH} images is the limit per batch`)
    } else {
      success(added.length === 1 ? `${added[0]?.name} added` : `${added.length} images added`)
    }
  }
  const removeBatchFile = (i: number) => setBatchFiles((prev) => prev.filter((_, idx) => idx !== i))

  const runBatch = async () => {
    if (batchFiles.length === 0) return
    setBatchPhase('processing')
    const out: BatchResult[] = []
    try {
      for (let i = 0; i < batchFiles.length; i++) {
        const file = batchFiles[i]
        setBatchProgress(`Removing background ${i + 1} of ${batchFiles.length}…`)
        try {
          const blob = await removeBg(file)
          out.push({ name: `${stem(file.name)}_nobg.png`, url: URL.createObjectURL(blob), blob })
        } catch (e) {
          console.error('Failed on', file.name, e)
        }
      }
      if (out.length === 0) { error('None of those images could be processed'); setBatchPhase('idle'); return }
      setBatchResults(out)
      setBatchPhase('results')
      if (out.length < batchFiles.length) {
        error(`${out.length} of ${batchFiles.length} done — ${batchFiles.length - out.length} could not be processed`)
      } else {
        success(`Backgrounds removed from all ${out.length} images`)
      }
    } catch {
      error('That batch could not be processed')
      setBatchPhase('idle')
    }
  }

  const downloadAllZip = async () => {
    try {
      const zip = new JSZip()
      batchResults.forEach((r) => zip.file(r.name, r.blob))
      const blob = await zip.generateAsync({ type: 'blob' })
      downloadBlob(blob, 'backgrounds-removed.zip')
      success(`${batchResults.length} cutouts downloaded as a ZIP`)
    } catch {
      error('The ZIP could not be built — try downloading images one by one')
    }
  }

  const resetBatch = () => { setBatchFiles([]); setBatchResults([]); setBatchPhase('idle') }

  usePaste(
    (file) => (mode === 'single' ? processSingle([file]) : addBatchFiles([file])),
    (mode === 'single' && phase === 'idle') || (mode === 'batch' && batchPhase === 'idle'),
  )

  const showToggle = (mode === 'single' && phase === 'idle') || (mode === 'batch' && batchPhase === 'idle')

  return (
    <>
      {showToggle && <ModeToggle mode={mode} accent={accent} onSwitch={switchMode} />}

      {/* ── SINGLE ── */}
      {mode === 'single' && phase === 'idle' && (
        <div className="max-w-xl mx-auto">
          <Dropzone onFiles={processSingle} label="Drop an image here" sub="or click to select a file, or paste" />
          <InfoBox />
        </div>
      )}
      {mode === 'single' && phase === 'processing' && (
        <ProcessingScreen label={progress.label} pct={progress.pct} accent={accent} showBar />
      )}
      {mode === 'single' && phase === 'done' && result && beforeUrl && (
        <div className="max-w-2xl mx-auto">
          <Compare before={beforeUrl} after={result.url} />
          <div className="flex flex-wrap justify-center gap-2 mt-5">
            <Button onClick={() => downloadBlob(result.blob, result.name)}><Download size={15} /> Download PNG</Button>
            <Button variant="secondary" onClick={resetSingle}><RotateCcw size={14} /> Process another</Button>
          </div>
        </div>
      )}

      {/* ── BATCH ── */}
      {mode === 'batch' && batchPhase === 'idle' && (
        <div className="max-w-xl mx-auto">
          <Dropzone multiple onFiles={addBatchFiles} label="Drop images here" sub={`${batchFiles.length} / ${MAX_BATCH} selected, or paste`} />
          {batchFiles.length > 0 && (
            <div className="mt-3 space-y-1 max-h-60 overflow-y-auto">
              {batchFiles.map((f, i) => (
                <FileRow key={i} name={f.name} onClear={() => removeBatchFile(i)} />
              ))}
            </div>
          )}
          <Button className="w-full mt-4" onClick={runBatch} disabled={batchFiles.length === 0}>
            Remove backgrounds · {batchFiles.length} image{batchFiles.length === 1 ? '' : 's'}
          </Button>
          <InfoBox />
        </div>
      )}
      {mode === 'batch' && batchPhase === 'processing' && <ProcessingScreen label={batchProgress} accent={accent} />}
      {mode === 'batch' && batchPhase === 'results' && (
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
            <div>
              <div className="font-display text-lg text-gray-800">
                {batchResults.length} image{batchResults.length === 1 ? '' : 's'} done
              </div>
              <div className="text-xs text-gray-400">Transparent PNGs, ready to download</div>
            </div>
            <Button onClick={downloadAllZip}><Package size={15} /> Download all (ZIP)</Button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-6">
            {batchResults.map((r) => <ResultTile key={r.name} r={r} />)}
          </div>
          <div className="flex justify-center">
            <Button variant="secondary" onClick={resetBatch}><Plus size={15} /> New batch</Button>
          </div>
        </div>
      )}

      <Toast toast={toast} onDone={clear} />
    </>
  )
}

function ProcessingScreen({ label, pct, accent, showBar }: { label: string; pct?: number; accent: string; showBar?: boolean }) {
  return (
    <div className="max-w-md mx-auto py-12">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="w-12 h-12 rounded-full border-[3px] border-gray-100" />
          <div className="absolute inset-0 rounded-full border-[3px] border-t-transparent animate-spin" style={{ borderColor: accent, borderTopColor: 'transparent' }} />
        </div>
        <div className="text-center">
          <div className="text-sm font-semibold text-gray-800">Processing</div>
          <div className="text-xs text-gray-400 mt-1">{label}</div>
        </div>
        {showBar && (
          <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full transition-all duration-200" style={{ width: `${pct ?? 0}%`, backgroundColor: accent }} />
          </div>
        )}
      </div>
    </div>
  )
}
