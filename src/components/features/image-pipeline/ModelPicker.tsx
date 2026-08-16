'use client'

import { Check, Sparkles } from 'lucide-react'
import { IMAGE_PROVIDERS, type ImageModelMeta, type ImageProvider } from '@/types/image-pipeline'

interface ModelPickerProps {
  /** Models this account may pick — already filtered by tier and setup server-side. */
  models: ImageModelMeta[]
  value: string
  onChange: (model: string) => void
  accent: string
}

const PROVIDER_LABEL: Record<ImageProvider, string> = {
  openai: 'ChatGPT',
  gemini: 'Google',
}

/**
 * Picks the engine that renders the image.
 *
 * The list comes from the server, not from the full catalogue: a model the
 * caller's tier can't use, or whose provider has no API key, is never shown —
 * so anything selectable here is something the server will actually accept.
 *
 * Grouped by provider because that is how the choice is really made ("ChatGPT
 * or Google?"), and each card states the size the final actually comes back at
 * rather than implying every engine produces 2K.
 */
export default function ModelPicker({ models, value, onChange, accent }: ModelPickerProps) {
  if (models.length === 0) {
    return (
      <div>
        <span className="block text-2xs font-semibold uppercase tracking-widest text-gray-300 mb-2">Image model</span>
        <p className="rounded-xl border border-gray-100 bg-gray-50 p-3 text-xs text-gray-500">
          No image model is set up yet. Add an OpenAI or Google API key to start generating.
        </p>
      </div>
    )
  }

  // Only show provider headings when there's actually more than one to tell apart.
  const providers = IMAGE_PROVIDERS.filter((p) => models.some((m) => m.provider === p))
  const grouped = providers.length > 1

  return (
    <div>
      <span className="block text-2xs font-semibold uppercase tracking-widest text-gray-300 mb-2">Image model</span>
      <div className="space-y-3">
        {providers.map((provider) => (
          <div key={provider}>
            {grouped && (
              <span className="block text-2xs font-medium text-gray-400 mb-1.5">{PROVIDER_LABEL[provider]}</span>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {models
                .filter((m) => m.provider === provider)
                .map((model) => (
                  <ModelCard
                    key={model.id}
                    model={model}
                    selected={value === model.id}
                    onSelect={() => onChange(model.id)}
                    accent={accent}
                  />
                ))}
            </div>
          </div>
        ))}
      </div>
      <p className="text-2xs text-gray-400 mt-2">
        Your choice is saved and pre-selected next time. A run always finishes on the model it started with.
      </p>
    </div>
  )
}

function ModelCard({
  model, selected, onSelect, accent,
}: {
  model: ImageModelMeta
  selected: boolean
  onSelect: () => void
  accent: string
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`flex items-start gap-2.5 rounded-xl border p-3 text-left transition-colors min-h-[44px] ${
        selected ? 'bg-white' : 'border-gray-100 bg-white hover:border-gray-200'
      }`}
      style={selected ? { borderColor: accent, boxShadow: `0 0 0 1px ${accent}` } : undefined}
    >
      <span
        aria-hidden
        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: `${accent}15`, color: accent }}
      >
        {selected ? <Check size={15} /> : <Sparkles size={15} />}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-gray-800">{model.label}</span>
        <span className="block text-2xs text-gray-400 leading-relaxed mt-0.5">{model.description}</span>
        <span className="block text-2xs text-gray-400 mt-1">
          Final renders at <span className="font-medium text-gray-600">{model.final_size_label}</span>
        </span>
      </span>
    </button>
  )
}
