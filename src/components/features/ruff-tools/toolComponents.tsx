import dynamic from 'next/dynamic'
import type { ComponentType } from 'react'
import type { RuffToolId, RuffToolProps } from '@/types/ruffTool'
import { Spinner } from '@/components/features/ruff-tools/ui'

/**
 * Tool components, lazy-loaded with `ssr: false`. Every tool is browser-only
 * (canvas, WASM, qr-code-styling, imagetracerjs), so they must never run during
 * server rendering — dynamic import with ssr:false keeps them out of the SSR
 * pass and out of the initial bundle until a card is opened.
 */
const loading = () => <div className="py-20"><Spinner label="Loading tool…" /></div>

export const TOOL_COMPONENTS: Record<RuffToolId, ComponentType<RuffToolProps>> = {
  'qr': dynamic(() => import('./tools/QrTool'), { ssr: false, loading }),
  'background-remover': dynamic(() => import('./tools/BackgroundRemoverTool'), { ssr: false, loading }),
  'matte': dynamic(() => import('./tools/MatteTool'), { ssr: false, loading }),
  'scroll': dynamic(() => import('./tools/ScrollTool'), { ssr: false, loading }),
  'social-cropper': dynamic(() => import('./tools/SocialCropperTool'), { ssr: false, loading }),
  'watermarker': dynamic(() => import('./tools/WatermarkerTool'), { ssr: false, loading }),
  'clipper': dynamic(() => import('./tools/ClipperTool'), { ssr: false, loading }),
  'splitter': dynamic(() => import('./tools/SplitterTool'), { ssr: false, loading }),
  'tracer': dynamic(() => import('./tools/TracerTool'), { ssr: false, loading }),
}
