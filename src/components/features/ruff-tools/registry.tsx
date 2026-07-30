import {
  QrCode, Eraser, Square, GalleryHorizontalEnd, Crop,
  Stamp, Scissors, Grid2x2, PenTool,
} from 'lucide-react'
import type { RuffTool, RuffToolGroup } from '@/types/ruffTool'

/**
 * Single source of truth for the Ruff Tools corner. The card grid, tool headers
 * and "How to use" detail panels all read from here.
 */
export const RUFF_TOOLS: RuffTool[] = [
  // Greatest Hits
  {
    id: 'qr', name: 'QR Generator', group: 'Greatest Hits', icon: QrCode,
    tagline: 'Create custom QR codes for any link or text — your colours, shapes and a centre logo.',
    howTo: [
      'Type or paste what the code should point to — the preview updates as you go.',
      'Style it: dot shape, colours, and drop in a centre logo if you like.',
      'Save a style you like and reuse it on the next code.',
      'Download as PNG or SVG when it looks right.',
    ],
  },
  {
    id: 'background-remover', name: 'Background Remover', group: 'Greatest Hits', icon: Eraser, badge: 'Beta',
    tagline: 'Erase the background from one image or a whole batch, right in your browser. Clean transparent PNGs.',
    howTo: [
      'Drop in one image or a batch — everything runs locally in your browser.',
      'The first run downloads a small AI model, so give it a moment.',
      'Each image is cut out to a transparent PNG on the checkerboard preview.',
      'Download singles, or grab the whole batch as a ZIP.',
    ],
  },

  // Social Media
  {
    id: 'matte', name: 'Matte Generator', group: 'Social Media', icon: Square,
    tagline: 'Place any image on a solid square canvas so it fits social feeds without being cropped.',
    howTo: [
      'Drop in the image you want to post.',
      'Choose a canvas colour and how much padding sits around the image.',
      'The image is centred on a square so nothing gets cropped by the feed.',
      'Download the squared-off PNG.',
    ],
  },
  {
    id: 'scroll', name: 'Seamless Scroll', group: 'Social Media', icon: GalleryHorizontalEnd,
    tagline: 'Slice a wide panorama into evenly sized slides for a seamless Instagram swipe carousel.',
    howTo: [
      'Drop in a wide (panorama) image.',
      'Choose how many slides the carousel should be, and the shape of each slide.',
      'The preview dims whatever gets trimmed to hit that shape — slides stay edge-to-edge.',
      'Download all slides together as a ZIP, in order.',
    ],
  },
  {
    id: 'social-cropper', name: 'Social Cropper', group: 'Social Media', icon: Crop,
    tagline: 'Crop an image to the exact pixel sizes Instagram uses for feed posts, stories and reels.',
    howTo: [
      'Drop in your image.',
      'Pick an Instagram size — 1:1, 4:5, 1.91:1, or 9:16 for stories and reels.',
      'Drag the crop box to frame the shot; it’s locked to the chosen ratio.',
      'Download it — the export lands on Instagram’s exact pixel dimensions.',
    ],
  },
  {
    id: 'watermarker', name: 'Watermarker', group: 'Social Media', icon: Stamp,
    tagline: 'Overlay your logo or watermark onto an image — control position, size and opacity.',
    howTo: [
      'Drop in the base image, then add a watermark (a transparent PNG works best).',
      'If your logo sits on a white block, switch its background to Remove.',
      'Set position, scale, opacity and margin — or tile it across the whole image.',
      'Save watermarks to your account to reuse them later, then download the PNG.',
    ],
  },

  // Images & Assets
  {
    id: 'clipper', name: 'Image Clipper', group: 'Images & Assets', icon: Scissors,
    tagline: 'Automatically trim the empty transparent border around a PNG to the tightest crop.',
    howTo: [
      'Drop in a PNG that has transparent space around it.',
      'The empty border is detected and trimmed to the tightest possible box.',
      'Compare the before/after on the checkerboard preview.',
      'Download the tightly-cropped PNG.',
    ],
  },
  {
    id: 'splitter', name: 'Image Splitter', group: 'Images & Assets', icon: Grid2x2,
    tagline: 'Cut one image into a grid of equal tiles and download them all together as a ZIP.',
    howTo: [
      'Drop in your image.',
      'Choose how many rows and columns to slice it into.',
      'The grid preview shows exactly where the cuts land.',
      'Download every tile together as a ZIP.',
    ],
  },
  {
    id: 'tracer', name: 'Image Tracer', group: 'Images & Assets', icon: PenTool,
    tagline: 'Convert a photo or logo into a scalable SVG vector that stays sharp at any size.',
    howTo: [
      'Drop in a photo or logo (simple, high-contrast art traces best).',
      'Tune detail, colours and smoothing to balance fidelity vs file size.',
      'Preview the vector rebuilt from paths next to the original.',
      'Download the result as an SVG.',
    ],
  },
]

export const RUFF_TOOL_GROUPS: RuffToolGroup[] = ['Greatest Hits', 'Social Media', 'Images & Assets']

export const getRuffTool = (id: string): RuffTool | undefined => RUFF_TOOLS.find((t) => t.id === id)
