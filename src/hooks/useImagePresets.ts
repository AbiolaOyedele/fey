'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  createPromptPreset,
  deletePromptPreset,
  listPromptPresets,
  pipelineErrorMessage,
  updatePromptPreset,
} from '@/lib/image-pipeline-api'
import { DEFAULT_PROMPT_PRESET_KEY, type PromptPresetOption, type UpsertPromptPresetRequest } from '@/types/image-pipeline'

interface ActionResult {
  ok: boolean
  message: string
}

interface PresetsState {
  presets: PromptPresetOption[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
  create: (input: UpsertPromptPresetRequest) => Promise<ActionResult>
  update: (id: string, input: UpsertPromptPresetRequest) => Promise<ActionResult>
  remove: (id: string) => Promise<ActionResult>
}

/**
 * Loads the presets a user can pick from (built-ins + the workspace's own) and
 * exposes create/update/delete for custom presets. Every mutation returns a
 * plain-English result the page turns into a toast.
 */
export function useImagePresets(): PresetsState {
  const [presets, setPresets] = useState<PromptPresetOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    try {
      setPresets(await listPromptPresets())
      setError(null)
    } catch (e) {
      setError(pipelineErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void refetch() }, [refetch])

  const create = useCallback(async (input: UpsertPromptPresetRequest): Promise<ActionResult> => {
    try {
      await createPromptPreset(input)
      await refetch()
      return { ok: true, message: 'Preset saved' }
    } catch (e) {
      return { ok: false, message: pipelineErrorMessage(e) }
    }
  }, [refetch])

  const update = useCallback(async (id: string, input: UpsertPromptPresetRequest): Promise<ActionResult> => {
    try {
      await updatePromptPreset(id, input)
      await refetch()
      return { ok: true, message: 'Preset updated' }
    } catch (e) {
      return { ok: false, message: pipelineErrorMessage(e) }
    }
  }, [refetch])

  const remove = useCallback(async (id: string): Promise<ActionResult> => {
    try {
      await deletePromptPreset(id)
      await refetch()
      return { ok: true, message: 'Preset deleted' }
    } catch (e) {
      return { ok: false, message: pipelineErrorMessage(e) }
    }
  }, [refetch])

  return { presets, loading, error, refetch, create, update, remove }
}

export { DEFAULT_PROMPT_PRESET_KEY }
