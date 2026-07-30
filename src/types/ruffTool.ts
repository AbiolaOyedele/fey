// Ruff Tools — a corner of small, browser-based utilities ported from the Sahl
// "Winston" suite. Each tool renders inside a modal over the corner grid.

import type { LucideIcon } from 'lucide-react'
import type { DotType, CornerSquareType, CornerDotType } from 'qr-code-styling'

export type RuffToolId =
  | 'qr'
  | 'background-remover'
  | 'matte'
  | 'scroll'
  | 'social-cropper'
  | 'watermarker'
  | 'clipper'
  | 'splitter'
  | 'tracer'

export type RuffToolGroup = 'Greatest Hits' | 'Social Media' | 'Images & Assets'

/** A single utility in the Ruff Tools corner. */
export interface RuffTool {
  id: RuffToolId
  name: string
  group: RuffToolGroup
  icon: LucideIcon
  /** One-liner — used as the card tooltip and header subtitle. */
  tagline: string
  /** Step-by-step usage shown by the in-tool "How to use" detail modal. */
  howTo: string[]
  badge?: string
}

/** Props every tool component receives from the corner shell. */
export interface RuffToolProps {
  /** Workspace accent hex, for on-brand touches inside the tool. */
  accent: string
}

/** A saved, reusable watermark (image lives in Cloudinary). */
export interface Watermark {
  id: string
  name: string
  image_url: string
  public_id: string
  width: number | null
  height: number | null
  created_at: string
}

/** QR error-correction level, lowest to highest damage tolerance. */
export type QrEcc = 'L' | 'M' | 'Q' | 'H'

/** The look of a QR code, without the content it encodes. */
export interface QrStyleValues {
  dark: string
  light: string
  dot: DotType
  eye: CornerSquareType
  pupil: CornerDotType
  margin: number
  ecc: QrEcc
}

/** A saved, named QR look. Kept on the device, not synced. */
export interface QrStyle extends QrStyleValues {
  id: string
  name: string
}

export interface CreateWatermarkPayload {
  name: string
  image_url: string
  public_id: string
  width?: number | null
  height?: number | null
}
