import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'

/**
 * A failed write must never revert in silence.
 *
 * These mutations are optimistic: the row changes before the server has agreed.
 * When the server refuses, the list rolls back — and for a long time it did so
 * with no message at all, so ticking a subtask looked like it worked and then
 * un-ticked itself a moment later. Indistinguishable from a bug.
 *
 * Each case here is one of those four mutations.
 */

const apiFetch = vi.fn()

vi.mock('@/lib/api-client', () => ({ apiFetch: (...a: unknown[]) => apiFetch(...a) }))

// The hook opens a realtime channel on mount; nothing here exercises it.
vi.mock('@/lib/supabase', () => ({
  supabase: {
    channel: () => ({ on() { return this }, subscribe() { return this } }),
    removeChannel: () => {},
  },
}))

const { useTasks } = await import('@/hooks/useTasks')

const TASK = {
  id: 't1', owner_id: 'o', workspace_id: 'w', project_id: null, contact_id: null,
  stage_id: 's1', created_by: 'u1', requested_by_portal_user: null, visibility: 'team',
  responsible_id: 'u1', stage_entered_at: new Date(0).toISOString(), approval_state: 'none',
  title: 'A task', description: null, priority: 'medium', start_date: null, due_date: null,
  estimated_minutes: null, logged_minutes: 0, sort_order: 0, done: false, completed_at: null,
  created_at: new Date(0).toISOString(), updated_at: new Date(0).toISOString(),
  assignees: [], responsible: null,
  subtasks: [{ id: 'sub1', task_id: 't1', title: 'Step one', done: false, sort_order: 0 }],
  files: [{ id: 'f1', file_name: 'a.png', file_url: 'u', public_id: 'p', file_size: 1, file_type: 'image/png', uploader_name: null, created_at: new Date(0).toISOString() }],
  project_title: null, contact_name: null, social_post: null,
}

/** Loads fine, then fails every write. */
function mountWithFailingWrites(onError: (m: string) => void, reason = 'Server said no') {
  apiFetch.mockImplementation((_url: string, init?: { method?: string }) => {
    if (!init?.method || init.method === 'GET') return Promise.resolve({ tasks: [structuredClone(TASK)] })
    return Promise.reject(new Error(reason))
  })
  return renderHook(() => useTasks({ scope: 'all', workspaceId: 'w', done: false, onError }))
}

beforeEach(() => { apiFetch.mockReset() })

describe('useTasks — failed writes are reported, not swallowed', () => {
  it('reports a failed subtask tick', async () => {
    const onError = vi.fn()
    const { result } = mountWithFailingWrites(onError)
    await waitFor(() => expect(result.current.tasks).toHaveLength(1))

    await act(async () => { await result.current.toggleSubtask('t1', 'sub1', true) })

    expect(onError).toHaveBeenCalledWith('Server said no')
  })

  it('reports a failed subtask rename', async () => {
    const onError = vi.fn()
    const { result } = mountWithFailingWrites(onError)
    await waitFor(() => expect(result.current.tasks).toHaveLength(1))

    await act(async () => { await result.current.renameSubtask('t1', 'sub1', 'Renamed') })

    expect(onError).toHaveBeenCalledWith('Server said no')
  })

  it('reports a failed subtask delete', async () => {
    const onError = vi.fn()
    const { result } = mountWithFailingWrites(onError)
    await waitFor(() => expect(result.current.tasks).toHaveLength(1))

    await act(async () => { await result.current.deleteSubtask('t1', 'sub1') })

    expect(onError).toHaveBeenCalledWith('Server said no')
  })

  it('reports a failed file removal', async () => {
    const onError = vi.fn()
    const { result } = mountWithFailingWrites(onError)
    await waitFor(() => expect(result.current.tasks).toHaveLength(1))

    await act(async () => { await result.current.removeFile('t1', 'f1') })

    expect(onError).toHaveBeenCalledWith('Server said no')
  })

  it('rolls the list back to what the server actually has', async () => {
    const onError = vi.fn()
    const { result } = mountWithFailingWrites(onError)
    await waitFor(() => expect(result.current.tasks).toHaveLength(1))

    await act(async () => { await result.current.deleteSubtask('t1', 'sub1') })

    // Optimistically removed, then restored by the reconciling refetch.
    await waitFor(() => expect(result.current.tasks[0]?.subtasks).toHaveLength(1))
  })

  it('says nothing when the write succeeds', async () => {
    const onError = vi.fn()
    apiFetch.mockImplementation((_url: string, init?: { method?: string }) => (
      !init?.method || init.method === 'GET'
        ? Promise.resolve({ tasks: [structuredClone(TASK)] })
        : Promise.resolve({})
    ))
    const { result } = renderHook(() => useTasks({ scope: 'all', workspaceId: 'w', done: false, onError }))
    await waitFor(() => expect(result.current.tasks).toHaveLength(1))

    await act(async () => { await result.current.toggleSubtask('t1', 'sub1', true) })

    expect(onError).not.toHaveBeenCalled()
  })
})
