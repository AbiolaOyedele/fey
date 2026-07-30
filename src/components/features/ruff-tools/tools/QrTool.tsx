'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import QRCodeStyling, {
  type Options,
  type DotType,
  type CornerSquareType,
  type CornerDotType,
  type FileExtension,
} from 'qr-code-styling'
import { Download, Copy, Link2, Mail, Phone, MessageSquare, MapPin, Save, X, type LucideIcon } from 'lucide-react'
import Toast from '@/components/features/ruff-tools/Toast'
import { Card, Label, Button, Slider, SegGroup, ColorField, Section } from '@/components/features/ruff-tools/ui'
import { useToast } from '@/components/features/ruff-tools/hooks'
import { useQrStyles } from '@/hooks/useQrStyles'
import type { RuffToolProps, QrEcc, QrStyle, QrStyleValues } from '@/types/ruffTool'

const DOT_STYLES: { label: string; value: DotType; hint: string }[] = [
  { label: 'Boxy', value: 'square', hint: 'Plain squares — the most scannable' },
  { label: 'Dots', value: 'dots', hint: 'Separate round dots' },
  { label: 'Rounded', value: 'rounded', hint: 'Squares with softened corners' },
  { label: 'Classy', value: 'classy', hint: 'Leaf-shaped dots with one sharp corner' },
  { label: 'Smooth', value: 'extra-rounded', hint: 'Heavily rounded, joined-up blocks' },
]
const EYE_STYLES: { label: string; value: CornerSquareType; hint: string }[] = [
  { label: 'Boxy', value: 'square', hint: 'Square frames around the three corners' },
  { label: 'Circle', value: 'dot', hint: 'Round frames around the three corners' },
  { label: 'Round', value: 'extra-rounded', hint: 'Squares with generously rounded corners' },
]
const PUPIL_STYLES: { label: string; value: CornerDotType; hint: string }[] = [
  { label: 'Square', value: 'square', hint: 'Square centre inside each corner frame' },
  { label: 'Circle', value: 'dot', hint: 'Round centre inside each corner frame' },
]
const ECC_LEVELS: { label: string; value: QrEcc; hint: string }[] = [
  { label: 'L', value: 'L', hint: 'Lowest — smallest pattern, least tolerant of damage' },
  { label: 'M', value: 'M', hint: 'Balanced — the usual choice' },
  { label: 'Q', value: 'Q', hint: 'High — survives more scuffs and overlays' },
  { label: 'H', value: 'H', hint: 'Highest — best with a centre logo, densest pattern' },
]
const QUICK_TYPES: { label: string; icon: LucideIcon; prefix: string; hint: string }[] = [
  { label: 'URL', icon: Link2, prefix: 'https://', hint: 'Opens a web address' },
  { label: 'Email', icon: Mail, prefix: 'mailto:', hint: 'Starts a new email' },
  { label: 'Phone', icon: Phone, prefix: 'tel:', hint: 'Dials a phone number' },
  { label: 'SMS', icon: MessageSquare, prefix: 'smsto:', hint: 'Starts a text message' },
  { label: 'Geo', icon: MapPin, prefix: 'geo:', hint: 'Drops a pin at coordinates, e.g. geo:51.5,-0.12' },
]

/** QR Generator — styled QR codes for any link or text. */
export default function QrTool({ accent }: RuffToolProps) {
  const { toast, success, error, clear } = useToast()
  const { styles: savedStyles, saveStyle, removeStyle } = useQrStyles()

  const [text, setText] = useState('')
  const [size, setSize] = useState(300)
  const [margin, setMargin] = useState(12)
  const [ecc, setEcc] = useState<QrEcc>('M')
  const [dark, setDark] = useState('#111111')
  const [light, setLight] = useState('#ffffff')
  const [dot, setDot] = useState<DotType>('square')
  const [eye, setEye] = useState<CornerSquareType>('square')
  const [pupil, setPupil] = useState<CornerDotType>('square')
  const [logo, setLogo] = useState<string | null>(null)
  const [logoSize, setLogoSize] = useState(22)
  const [styleName, setStyleName] = useState('')

  const holderRef = useRef<HTMLDivElement>(null)
  const qrRef = useRef<QRCodeStyling | null>(null)

  const quickStyles = useMemo<{ name: string; dot: DotType; dark: string }[]>(() => [
    { name: 'Brand', dot: 'rounded', dark: accent },
    { name: 'Classic', dot: 'square', dark: '#111111' },
    { name: 'Rounded', dot: 'rounded', dark: '#111111' },
    { name: 'Dots', dot: 'dots', dark: '#111111' },
    { name: 'Classy', dot: 'classy', dark: '#111111' },
    { name: 'Indigo', dot: 'rounded', dark: '#4f46e5' },
    { name: 'Teal', dot: 'extra-rounded', dark: '#0d9488' },
    { name: 'Forest', dot: 'classy', dark: '#15803d' },
  ], [accent])

  const options: Options = useMemo(() => {
    const opts: Options = {
      width: size,
      height: size,
      type: 'svg',
      data: text || ' ',
      margin,
      qrOptions: { errorCorrectionLevel: ecc },
      dotsOptions: { color: dark, type: dot },
      cornersSquareOptions: { color: dark, type: eye },
      cornersDotOptions: { color: dark, type: pupil },
      backgroundOptions: { color: light },
    }
    if (logo) {
      opts.image = logo
      opts.imageOptions = { imageSize: logoSize / 100, margin: 4, crossOrigin: 'anonymous' }
    }
    return opts
  }, [text, size, margin, ecc, dark, light, dot, eye, pupil, logo, logoSize])

  useEffect(() => {
    if (!qrRef.current) {
      qrRef.current = new QRCodeStyling(options)
      if (holderRef.current) qrRef.current.append(holderRef.current)
    } else {
      qrRef.current.update(options)
    }
  }, [options])

  const onLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result !== 'string') { error('That image could not be read'); return }
      setLogo(reader.result)
      success('Logo added to the centre of the code')
    }
    reader.onerror = () => error('That image could not be read')
    reader.readAsDataURL(f)
  }

  const applyQuick = (s: { name: string; dot: DotType; dark: string }) => {
    setDot(s.dot); setDark(s.dark)
    success(`${s.name} style applied`)
  }

  const applySaved = (s: QrStyle) => {
    setDark(s.dark); setLight(s.light)
    setDot(s.dot); setEye(s.eye); setPupil(s.pupil)
    setMargin(s.margin); setEcc(s.ecc)
    success(`“${s.name}” applied`)
  }

  const currentValues: QrStyleValues = { dark, light, dot, eye, pupil, margin, ecc }

  const saveCurrentStyle = () => {
    try {
      const saved = saveStyle(styleName, currentValues)
      setStyleName('')
      success(`“${saved.name}” saved to your styles`)
    } catch {
      error('That style could not be saved on this device')
    }
  }

  const deleteStyle = (s: QrStyle) => {
    removeStyle(s.id)
    success(`“${s.name}” removed`)
  }

  const download = async (ext: FileExtension) => {
    try {
      await qrRef.current?.download({ name: 'qr-code', extension: ext })
      success(`${ext.toUpperCase()} saved to your downloads`)
    } catch {
      error(`That ${ext.toUpperCase()} could not be created — try a smaller size`)
    }
  }

  const copyPng = async () => {
    try {
      const blob = await qrRef.current?.getRawData('png')
      if (!blob || !(blob instanceof Blob)) throw new Error('no blob')
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      success('QR code copied to your clipboard')
    } catch {
      error('Your browser blocked the clipboard — use Download instead')
    }
  }

  const hasData = text.trim().length > 0

  return (
    <>
      <div className="grid lg:grid-cols-[1fr_300px] gap-6 items-start">
        <div className="space-y-5">
          <Card className="p-5">
            <Label hint="Anything a phone camera can act on — a link, plain text, an email address or a phone number.">
              Content
            </Label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Enter URL, text, or data…"
              className="w-full min-h-24 max-h-40 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-xs2 font-mono text-gray-700 outline-none focus:border-gray-300 resize-y"
            />
            <div className="flex flex-wrap gap-1.5 mt-3">
              {QUICK_TYPES.map(({ label, icon: Icon, prefix, hint }) => (
                <button
                  key={label}
                  onClick={() => setText((t) => (t.startsWith(prefix) ? t : prefix + t))}
                  title={hint}
                  aria-label={`${label} — ${hint}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-200 bg-white text-2xs font-medium text-gray-500 hover:border-gray-300 cursor-pointer transition-colors"
                >
                  <Icon size={12} /> {label}
                </button>
              ))}
            </div>
          </Card>

          <Card className="p-6 flex flex-col items-center">
            <div className="relative max-w-full">
              {/* The code renders at its export size; scale it down to fit narrow screens */}
              <div
                ref={holderRef}
                className={`max-w-full [&_svg]:max-w-full [&_svg]:h-auto ${hasData ? '' : 'opacity-20'}`}
              />
              {!hasData && (
                <div className="absolute inset-0 flex items-center justify-center text-center px-6">
                  <span className="text-xs text-gray-400 font-medium">Enter content to generate your QR code</span>
                </div>
              )}
            </div>
            <div className="flex flex-wrap justify-center gap-2 mt-5">
              <Button onClick={() => download('png')} disabled={!hasData}><Download size={15} /> PNG</Button>
              <Button variant="secondary" onClick={() => download('svg')} disabled={!hasData}><Download size={14} /> SVG</Button>
              <Button variant="secondary" onClick={copyPng} disabled={!hasData}><Copy size={14} /> Copy</Button>
            </div>
          </Card>

          <div>
            <Label hint="One-tap starting points. They set the dot shape and colour — everything else stays as you left it.">
              Quick styles
            </Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {quickStyles.map((s) => (
                <button
                  key={s.name}
                  onClick={() => applyQuick(s)}
                  className="py-2 rounded-lg border border-gray-200 bg-white text-2xs font-medium text-gray-600 hover:border-gray-300 cursor-pointer transition-colors flex items-center justify-center gap-1.5"
                >
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: s.dark }} />
                  {s.name}
                </button>
              ))}
            </div>
          </div>

          {/* Saved styles — colours, shapes, padding and error correction, kept on this device */}
          <div>
            <Label hint="Saves the current colours, shapes, padding and error correction so you can reuse the same look. Stored on this device.">
              Your styles
            </Label>
            <div className="flex items-center gap-2">
              <input
                value={styleName}
                onChange={(e) => setStyleName(e.target.value)}
                placeholder="Name this style…"
                maxLength={40}
                className="flex-1 min-w-0 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs2 text-gray-700 outline-none focus:border-gray-300"
              />
              <Button onClick={saveCurrentStyle} className="!px-3" aria-label="Save this style">
                <Save size={15} /> Save
              </Button>
            </div>
            {savedStyles.length === 0 ? (
              <p className="text-2xs text-gray-400 mt-2">
                None yet — style a code you like, give it a name, and it&apos;s one tap away next time.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5 mt-2.5">
                {savedStyles.map((s) => (
                  <span
                    key={s.id}
                    className="inline-flex items-center rounded-full border border-gray-200 bg-white overflow-hidden"
                  >
                    <button
                      onClick={() => applySaved(s)}
                      title={`Use “${s.name}”`}
                      className="inline-flex items-center gap-1.5 pl-3 pr-2 py-2 text-2xs font-medium text-gray-600 border-none bg-transparent hover:text-gray-900 cursor-pointer transition-colors"
                    >
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 border border-black/5" style={{ background: s.dark }} />
                      {s.name}
                    </button>
                    <button
                      onClick={() => deleteStyle(s)}
                      title={`Delete “${s.name}”`}
                      aria-label={`Delete ${s.name}`}
                      className="px-2 py-2 text-gray-300 hover:text-red-500 border-none bg-transparent cursor-pointer transition-colors"
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <Card className="p-5">
          <Section title="Basics">
            <Slider
              label="Size"
              value={size}
              min={100}
              max={1000}
              step={10}
              onChange={setSize}
              suffix="px"
              hint="Pixel width of the exported PNG. SVG scales to any size regardless."
            />
            <Slider
              label="Padding"
              value={margin}
              min={0}
              max={60}
              onChange={setMargin}
              suffix="px"
              hint="Quiet space around the code. Scanners need a little breathing room."
            />
            <div>
              <Label hint="How much of the code can be damaged or covered and still scan. Higher levels pack in more dots.">
                Error correction
              </Label>
              <SegGroup<QrEcc> options={ECC_LEVELS} value={ecc} onChange={setEcc} />
            </div>
          </Section>
          <Section title="Colours">
            <ColorField label="Dots" value={dark} onChange={setDark} />
            <ColorField label="Background" value={light} onChange={setLight} />
            <p className="text-3xs text-gray-400 leading-snug">
              Keep strong contrast between the two — light dots on a dark background often fail to scan.
            </p>
          </Section>
          <Section title="Shapes">
            <div>
              <Label hint="Shape of the small dots that make up the body of the code.">Dot style</Label>
              <SegGroup options={DOT_STYLES} value={dot} onChange={setDot} columns={3} />
            </div>
            <div>
              <Label hint="The three big squares in the corners — how a camera finds and orients the code.">Eyes</Label>
              <SegGroup options={EYE_STYLES} value={eye} onChange={setEye} />
            </div>
            <div>
              <Label hint="The small block sitting inside each corner square.">Pupils</Label>
              <SegGroup options={PUPIL_STYLES} value={pupil} onChange={setPupil} />
            </div>
          </Section>
          <Section title="Logo" defaultOpen={false}>
            <Label hint="Drops an image into the centre. Raise error correction to H so the code still scans.">
              Centre logo
            </Label>
            <label className="block">
              <span className="inline-block px-3 py-2 rounded-lg border border-gray-200 bg-white text-xs font-medium text-gray-600 hover:border-gray-300 cursor-pointer transition-colors">
                {logo ? 'Change image' : 'Upload image'}
              </span>
              <input type="file" accept="image/*" onChange={onLogo} hidden />
            </label>
            {logo && (
              <>
                <Slider
                  label="Logo size"
                  value={logoSize}
                  min={10}
                  max={35}
                  onChange={setLogoSize}
                  suffix="%"
                  hint="How much of the code the logo covers. Past roughly 25% scanning gets unreliable."
                />
                <button onClick={() => setLogo(null)} className="text-2xs font-medium text-gray-400 hover:text-gray-700 border-none bg-transparent cursor-pointer p-0">
                  Remove logo
                </button>
              </>
            )}
          </Section>
        </Card>
      </div>

      <Toast toast={toast} onDone={clear} />
    </>
  )
}
