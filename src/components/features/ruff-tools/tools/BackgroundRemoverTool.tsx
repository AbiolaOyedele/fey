'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import {
  Download, RotateCcw, ShieldCheck, Plus, X,
  Image as ImageIcon, Package, Zap, Gem, Cpu, Settings2, ChevronDown, Check,
} from 'lucide-react'
import JSZip from 'jszip'
import type { PreTrainedModel, Processor, Tensor } from '@huggingface/transformers'
import Dropzone from '@/components/features/ruff-tools/Dropzone'
import Toast from '@/components/features/ruff-tools/Toast'
import { Button } from '@/components/features/ruff-tools/ui'
import { useToast, usePaste } from '@/components/features/ruff-tools/hooks'
import { downloadBlob, stem, CHECKER } from '@/utils/ruffImage'
import type { RuffToolProps } from '@/types/ruffTool'

const MAX_BATCH = 50

/* ─────────────────────────────────────────────────────────────────────────────
 * Engines. Two models, chosen by device capability (or a manual override):
 *   • 'fast' — @imgly isnet_fp16 (~88 MB WASM). Runs anywhere; great for phones.
 *   • 'best' — BEN2 (MIT) on WebGPU via transformers.js (~219 MB fp16, cached).
 *     Much sharper edges than Fast. WebGPU only: BEN2 at 1024² overflows the
 *     4 GB WASM address space (std::bad_alloc), and the BiRefNet family is a
 *     dead end entirely — its shaders need 11 storage buffers where
 *     Apple-Silicon WebGPU caps at 10, and it OOMs on WASM too. BEN2's graph
 *     compiles cleanly on Mac WebGPU (verified). If Best fails on a device,
 *     we fall back to Fast automatically instead of surfacing an error.
 * Both load lazily so neither ships in the initial bundle.
 * ──────────────────────────────────────────────────────────────────────────── */

type Engine = 'fast' | 'best'
type Quality = 'auto' | 'fast' | 'best'
type UnifiedProgress = (label: string, pct: number) => void

const BEN2_MODEL = 'onnx-community/BEN2-ONNX'
/** Approx one-time downloads, surfaced in the quality menu so they're never a surprise. */
const BEST_MODEL_MB = 219
const FAST_MODEL_MB = 88

/* Where each engine's weights live once downloaded. Fast is mirrored into Cache
 * Storage by our service worker (@imgly caches nothing itself); Best is handled
 * by transformers.js. `FAST_MODEL_CACHE` must match MODEL_CACHE in public/sw.js. */
const FAST_MODEL_CACHE = 'fey-ml-models-v1'
const FAST_MODEL_URL_MATCH = 'background-removal-data'
const BEST_MODEL_CACHE = 'transformers-cache'
const BEST_MODEL_URL_MATCH = 'BEN2'

/**
 * Ask the browser to exempt our storage from casual eviction. Without this,
 * cached models are "best-effort" and get cleared under disk pressure — the
 * whole point of caching an 88 MB file is that it survives. Fire-and-forget:
 * Chrome decides silently on engagement, and a refusal just means we're back
 * to the old behaviour. Memoized — a batch run calls this once per image
 * otherwise, and the answer can't change mid-session.
 */
let persistRequest: Promise<void> | null = null
function requestPersistentStorage(): Promise<void> {
  persistRequest ??= (async () => {
    try {
      if (typeof navigator === 'undefined' || !navigator.storage?.persist) return
      if (await navigator.storage.persisted()) return
      await navigator.storage.persist()
    } catch {
      /* not supported here — nothing to do */
    }
  })()
  return persistRequest
}

/** Whether an engine's weights are already on disk, so we can say so up front. */
async function isEngineCached(engine: Engine): Promise<boolean> {
  if (typeof caches === 'undefined') return false
  const [name, match] = engine === 'best'
    ? [BEST_MODEL_CACHE, BEST_MODEL_URL_MATCH]
    : [FAST_MODEL_CACHE, FAST_MODEL_URL_MATCH]
  try {
    const keys = await (await caches.open(name)).keys()
    return keys.some((req) => req.url.includes(match))
  } catch {
    return false
  }
}

/**
 * Whether this device has a genuinely usable WebGPU adapter. `'gpu' in navigator`
 * is not enough — the property exists on browsers that still hand back a null
 * adapter (blocklisted drivers, Linux without flags, some VMs). Memoized: the
 * answer cannot change within a page load.
 */
type GpuLike = { requestAdapter: () => Promise<unknown> }
let webgpuAdapterOk: boolean | null = null
async function hasWebGPU(): Promise<boolean> {
  if (webgpuAdapterOk !== null) return webgpuAdapterOk
  if (typeof navigator === 'undefined') return false
  const gpu = (navigator as Navigator & { gpu?: GpuLike }).gpu
  if (!gpu) { webgpuAdapterOk = false; return false }
  try {
    webgpuAdapterOk = (await gpu.requestAdapter()) != null
  } catch {
    webgpuAdapterOk = false
  }
  return webgpuAdapterOk
}

/**
 * Whether Auto should default to the Best engine: a laptop/desktop with a real
 * WebGPU adapter and enough memory/cores. Phones and low-memory devices default
 * to Fast. Heuristic only — users can override with the quality menu, and a
 * manual Best still falls back to Fast if the device can't run it.
 */
async function isCapableDevice(): Promise<boolean> {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return false
  if (!(await hasWebGPU())) return false                // Best needs WebGPU
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory
  const cores = navigator.hardwareConcurrency || 0
  const coarse = window.matchMedia?.('(pointer: coarse)')?.matches ?? false
  const narrow = window.innerWidth < 820
  if (typeof mem === 'number' && mem <= 4) return false // low-memory device
  if (coarse && narrow) return false                    // phone-like
  return cores >= 4
}

/* ── Fast: @imgly isnet_fp16 ── */
async function removeBgFast(file: File, onProgress?: UnifiedProgress): Promise<Blob> {
  const { removeBackground } = await import('@imgly/background-removal')
  return removeBackground(file, {
    model: 'isnet_fp16',
    ...(onProgress
      ? {
          progress: (key: string, current: number, total: number) => {
            const pct = total > 0 ? Math.round((current / total) * 100) : 0
            onProgress(key.includes('fetch') ? `Downloading engine… ${pct}%` : 'Removing background…', pct)
          },
        }
      : {}),
  })
}

/* ── Best: BEN2 via transformers.js (module-level singletons, loaded once) ── */
let ben2Model: PreTrainedModel | null = null
let ben2Processor: Processor | null = null

async function removeBgBest(file: File, onProgress?: UnifiedProgress): Promise<Blob> {
  const { AutoModel, AutoProcessor, RawImage } = await import('@huggingface/transformers')

  if (!ben2Model || !ben2Processor) {
    onProgress?.('Downloading model…', 0)
    // WebGPU on purpose — see the engine note above (BEN2 OOMs the 4 GB WASM
    // address space at its fixed 1024² input). fp16 is the published dtype.
    ben2Model = await AutoModel.from_pretrained(BEN2_MODEL, {
      dtype: 'fp16',
      device: 'webgpu',
      progress_callback: (p: { status?: string; loaded?: number; total?: number }) => {
        if (p.status === 'progress' && p.total) {
          const pct = Math.round((p.loaded ?? 0) / p.total * 100)
          onProgress?.(`Downloading model… ${pct}%`, pct)
        }
      },
    })
    ben2Processor = await AutoProcessor.from_pretrained(BEN2_MODEL)
  }

  onProgress?.('Removing background…', 100)
  const url = URL.createObjectURL(file)
  try {
    const image = await RawImage.fromURL(url)
    const processed = (await ben2Processor(image)) as { pixel_values: Tensor }
    const outputs = (await ben2Model(processed)) as Record<string, Tensor>

    // Be tolerant of the exact output name across model revisions (BEN2: 'alphas').
    let out: Tensor | undefined = outputs.alphas ?? Object.values(outputs)[0]
    if (!out) throw new Error('The model returned no mask')
    // RawImage.fromTensor needs exactly 3 dims — peel batch dims off a [1,1,H,W].
    while (out.dims.length > 3) out = (out as unknown as Tensor[])[0]

    // BEN2 emits ready-made 0–1 alphas; only squash if a revision emits logits.
    let lo = Infinity, hi = -Infinity
    for (const v of out.data as Float32Array) { if (v < lo) lo = v; if (v > hi) hi = v }
    const alpha = (lo < -0.01 || hi > 1.01 ? out.sigmoid() : out).mul(255).to('uint8')

    const mask = await RawImage.fromTensor(alpha).resize(image.width, image.height)
    // Library-native compositing: force RGBA, then set the matte as the alpha.
    const cutout = image.rgba()
    cutout.putAlpha(mask)
    return await cutout.toBlob('image/png')
  } finally {
    URL.revokeObjectURL(url)
  }
}

interface RemovalOutcome { blob: Blob; usedFallback: boolean }

async function runRemoval(engine: Engine, file: File, onProgress?: UnifiedProgress): Promise<RemovalOutcome> {
  // Ask before the first big download, not on page load — a storage prompt
  // (Firefox shows one) makes sense at the moment we're about to use it.
  await requestPersistentStorage()

  if (engine === 'best') {
    // Pre-flight before a single byte is fetched. transformers.js downloads the
    // ~219 MB weights first and only resolves the execution provider when it
    // builds the session, so without this check a WebGPU-less device would pay
    // for the whole model and then fall back anyway.
    if (await hasWebGPU()) {
      try {
        return { blob: await removeBgBest(file, onProgress), usedFallback: false }
      } catch (e) {
        // Adapter exists but the graph wouldn't run here (e.g. a shader limit) —
        // only surfaces at inference, so it can't be pre-flighted. Degrade.
        console.warn('[bg-remove] Best engine failed, falling back to Fast', e)
      }
    } else {
      console.info('[bg-remove] no WebGPU adapter — using Fast, skipped the Best download')
    }
    return { blob: await removeBgFast(file, onProgress), usedFallback: true }
  }
  return { blob: await removeBgFast(file, onProgress), usedFallback: false }
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
    <div className="flex bg-white border border-gray-200 rounded-full p-1 max-w-xs mx-auto">
      {(['single', 'batch'] as const).map((m) => {
        const active = mode === m
        return (
          <button
            key={m}
            onClick={() => onSwitch(m)}
            className="flex-1 py-2 rounded-full text-xs2 font-medium transition-all cursor-pointer border-none"
            style={active ? { backgroundColor: `var(--accent-fill, ${accent})`, color: '#fff' } : { background: 'transparent', color: '#9ca3af' }}
          >
            {m === 'single' ? 'Single image' : `Batch (up to ${MAX_BATCH})`}
          </button>
        )
      })}
    </div>
  )
}

/** What each engine will cost the user right now, in plain English. */
function downloadNote(cached: boolean | null, sizeMb: number): string {
  if (cached === null) return '' // still checking — say nothing rather than guess
  return cached ? 'Ready — no download' : `One-time ~${sizeMb} MB download`
}

interface EngineReadiness {
  fastCached: boolean | null
  bestCached: boolean | null
  gpuOk: boolean | null
}

/** Compact quality picker — a small popover, so it sits out of the way. */
function QualityMenu({
  quality, accent, readiness, onSwitch,
}: {
  quality: Quality
  accent: string
  readiness: EngineReadiness
  onSwitch: (q: Quality) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const { fastCached, bestCached, gpuOk } = readiness
  const opts: { key: Quality; label: string; desc: string; note: string; icon: typeof Zap }[] = [
    { key: 'auto', label: 'Auto', desc: 'Picks the right model for this device', note: '', icon: Cpu },
    { key: 'fast', label: 'Fast', desc: 'Light · instant · runs anywhere', note: downloadNote(fastCached, FAST_MODEL_MB), icon: Zap },
    {
      key: 'best',
      label: 'Best',
      desc: 'Sharpest edges · runs on your GPU',
      // Be honest when the device can't run it, instead of letting them pick it
      // and silently getting Fast back.
      note: gpuOk === false ? 'Needs WebGPU — this device will use Fast' : downloadNote(bestCached, BEST_MODEL_MB),
      icon: Gem,
    },
  ]
  const current = opts.find((o) => o.key === quality)

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 h-9 text-xs2 font-medium text-gray-600 hover:border-gray-300 transition-colors cursor-pointer"
      >
        <Settings2 size={14} className="text-gray-400" />
        <span className="text-gray-400">Quality</span>
        <span style={{ color: accent }}>{current?.label ?? 'Auto'}</span>
        <ChevronDown size={13} className={`text-gray-300 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-1.5 w-64 rounded-xl border border-gray-100 bg-white shadow-lg p-1">
          {opts.map(({ key, label, desc, note, icon: Icon }) => {
            const active = quality === key
            return (
              <button
                key={key}
                type="button"
                onClick={() => { onSwitch(key); setOpen(false) }}
                className="w-full flex items-start gap-2 rounded-lg px-2.5 py-2 text-left hover:bg-gray-50 transition-colors cursor-pointer border-none bg-transparent"
              >
                <Icon size={15} className="mt-0.5 flex-shrink-0" style={{ color: active ? accent : '#9ca3af' }} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="text-xs2 font-semibold text-gray-800">{label}</span>
                    {active && <Check size={13} style={{ color: accent }} />}
                  </span>
                  <span className="block text-3xs text-gray-400 leading-relaxed">{desc}</span>
                  {note && <span className="block text-3xs text-gray-300 leading-relaxed">{note}</span>}
                </span>
              </button>
            )
          })}
        </div>
      )}
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
        Processing happens entirely in your browser — your images never leave your device.
        The first run downloads a one-time engine, then it&apos;s cached for later.
      </p>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════ */
/** Background Remover — cut out backgrounds locally, single or batch. */
export default function BackgroundRemoverTool({ accent }: RuffToolProps) {
  const { toast, success, error, clear } = useToast()
  const [mode, setMode] = useState<Mode>('single')

  /* engine selection */
  const [quality, setQuality] = useState<Quality>('auto')
  const [capable, setCapable] = useState<boolean | null>(null)
  const [readiness, setReadiness] = useState<EngineReadiness>({ fastCached: null, bestCached: null, gpuOk: null })

  // All of this reads navigator/window/caches, so it must run after mount to
  // stay SSR-safe and avoid a hydration mismatch. Re-runs via `probe` after a
  // successful removal, so "One-time download" flips to "Ready" without a reload.
  const [probe, setProbe] = useState(0)
  useEffect(() => {
    let alive = true
    void (async () => {
      const [ok, gpuOk, fastCached, bestCached] = await Promise.all([
        isCapableDevice(), hasWebGPU(), isEngineCached('fast'), isEngineCached('best'),
      ])
      if (!alive) return
      setCapable(ok)
      setReadiness({ fastCached, bestCached, gpuOk })
    })()
    return () => { alive = false }
  }, [probe])

  const engine: Engine = quality === 'best' || (quality === 'auto' && capable === true) ? 'best' : 'fast'

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
      const { blob, usedFallback } = await runRemoval(engine, file, (label, pct) => setProgress({ label, pct }))
      setResult({ url: URL.createObjectURL(blob), blob, name: `${stem(file.name)}_nobg.png` })
      setPhase('done')
      setProbe((n) => n + 1) // weights are on disk now — refresh the menu's note
      success(usedFallback ? 'Background removed — Best isn’t supported here, so Fast was used' : 'Background removed')
    } catch (e) {
      console.error('[bg-remove] failed', e)
      error('The background could not be removed — try a different image')
      setPhase('idle')
    }
  }, [engine, success, error])

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
        if (!file) continue
        const prefix = `(${i + 1}/${batchFiles.length}) `
        setBatchProgress(`${prefix}Removing background…`)
        try {
          const { blob } = await runRemoval(engine, file, (label) => setBatchProgress(`${prefix}${label}`))
          out.push({ name: `${stem(file.name)}_nobg.png`, url: URL.createObjectURL(blob), blob })
        } catch (e) {
          console.error('Failed on', file.name, e)
        }
      }
      if (out.length === 0) { error('None of those images could be processed'); setBatchPhase('idle'); return }
      setBatchResults(out)
      setBatchPhase('results')
      setProbe((n) => n + 1) // weights are on disk now — refresh the menu's note
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
      {showToggle && (
        <div className="relative mb-6">
          <ModeToggle mode={mode} accent={accent} onSwitch={switchMode} />
          <div className="mt-2 flex justify-center sm:mt-0 sm:absolute sm:top-0 sm:right-0">
            <QualityMenu quality={quality} accent={accent} readiness={readiness} onSwitch={setQuality} />
          </div>
        </div>
      )}

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
            <div className="h-full transition-all duration-200" style={{ width: `${pct ?? 0}%`, backgroundColor: `var(--accent-fill, ${accent})` }} />
          </div>
        )}
      </div>
    </div>
  )
}
