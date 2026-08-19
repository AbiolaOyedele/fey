import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import NewTaskModal from '@/components/tasks/NewTaskModal'

/**
 * Filing a client's task under a brand.
 *
 * The portal hides the link pickers wholesale, because which client a portal
 * task belongs to is a given. The brand isn't — and a task raised without one
 * lands as unbranded work: absent from that brand's board and counted under
 * "No brand" in the agency's reporting.
 *
 * The list can't come from `useProjects`, which fetches as an authenticated
 * user, so it's passed in. These tests hold that seam: the picker only appears
 * where a caller supplied brands, and what it sends is the id the server will
 * check ownership on.
 */

vi.mock('@/hooks/useCrm', () => ({ useContacts: () => ({ contacts: [] }) }))
vi.mock('@/hooks/useProjects', () => ({ useProjects: () => ({ projects: [] }) }))
vi.mock('@/hooks/useScrollLock', () => ({ useScrollLock: () => {} }))
vi.mock('@/components/tasks/AssigneePicker', () => ({ default: () => null }))

const BRANDS = [
  { id: 'p1', title: 'Ruff Studio' },
  { id: 'p2', title: 'Northbound' },
]

function renderPortalSheet(onCreate = vi.fn().mockResolvedValue({})) {
  render(
    <NewTaskModal
      workspaceId={null}
      hideLinks
      lockedVisibility="team"
      brands={BRANDS}
      stages={[]}
      onCreate={onCreate}
      onClose={vi.fn()}
    />,
  )
  return onCreate
}

describe('NewTaskModal — brand picker', () => {
  it('offers the brands it was given, and no brand as a real option', () => {
    renderPortalSheet()
    const select = screen.getByLabelText('Brand')
    expect(select).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Ruff Studio' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Northbound' })).toBeInTheDocument()
    // Not every request belongs to a brand, and forcing a guess would put work
    // against the wrong one — which is worse than leaving it unfiled.
    expect(screen.getByRole('option', { name: /no particular brand/i })).toBeInTheDocument()
  })

  it('sends the chosen brand as project_id', async () => {
    const user = userEvent.setup()
    const onCreate = renderPortalSheet()

    await user.type(screen.getByPlaceholderText('Task title…'), 'New billboard')
    await user.selectOptions(screen.getByLabelText('Brand'), 'p2')
    // Twice: nobody is assigned, so the first press raises the "nobody's on
    // this" nudge. Covered properly in its own describe below.
    await user.click(screen.getByRole('button', { name: 'Add task' }))
    await user.click(screen.getByRole('button', { name: 'Add task' }))

    expect(onCreate).toHaveBeenCalledTimes(1)
    expect(onCreate.mock.calls[0]![0]).toMatchObject({ title: 'New billboard', project_id: 'p2' })
  })

  it('sends no brand when none is chosen', async () => {
    const user = userEvent.setup()
    const onCreate = renderPortalSheet()

    await user.type(screen.getByPlaceholderText('Task title…'), 'Unfiled')
    await user.click(screen.getByRole('button', { name: 'Add task' }))
    await user.click(screen.getByRole('button', { name: 'Add task' }))

    expect(onCreate.mock.calls[0]![0]).toMatchObject({ project_id: null })
  })

  it('stays hidden when the caller has no brands to offer', () => {
    render(
      <NewTaskModal
        workspaceId={null}
        hideLinks
        lockedVisibility="team"
        brands={[]}
        stages={[]}
        onCreate={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    // An empty picker teaches a client nothing except that they're missing
    // something. A client with no brands simply doesn't see the control.
    expect(screen.queryByLabelText('Brand')).not.toBeInTheDocument()
  })

  it('meets the 44px tap target minimum', () => {
    renderPortalSheet()
    expect(screen.getByLabelText('Brand').className).toContain('min-h-11')
  })
})

/**
 * A task that isn't personal and has nobody on it.
 *
 * Unassigned team work lands on a board where everyone assumes somebody else
 * has it. The prompt is a nudge, not a gate: "I don't know who yet" is a real
 * answer, and pressing again goes through.
 */
describe('NewTaskModal — unassigned team task', () => {
  function renderTeamSheet(onCreate = vi.fn().mockResolvedValue({})) {
    render(
      <NewTaskModal
        workspaceId={null}
        hideLinks
        lockedVisibility="team"
        brands={BRANDS}
        members={[{ user_id: 'u1', name: 'Ada', email: null }]}
        stages={[]}
        onCreate={onCreate}
        onClose={vi.fn()}
      />,
    )
    return onCreate
  }

  it('asks before raising work nobody is on', async () => {
    const user = userEvent.setup()
    const onCreate = renderTeamSheet()
    await user.type(screen.getByPlaceholderText('Task title…'), 'Nobody on this')
    await user.click(screen.getByRole('button', { name: 'Add task' }))

    expect(onCreate).not.toHaveBeenCalled()
    expect(screen.getByText(/Nobody’s on this yet/)).toBeInTheDocument()
  })

  it('goes through on the second press — a nudge, not a gate', async () => {
    const user = userEvent.setup()
    const onCreate = renderTeamSheet()
    await user.type(screen.getByPlaceholderText('Task title…'), 'Nobody on this')
    await user.click(screen.getByRole('button', { name: 'Add task' }))
    await user.click(screen.getByRole('button', { name: 'Add task' }))

    expect(onCreate).toHaveBeenCalledTimes(1)
    expect(onCreate.mock.calls[0]![0]).toMatchObject({ assignee_ids: [] })
  })

  it('never asks when there is nobody to assign to', async () => {
    const user = userEvent.setup()
    const onCreate = vi.fn().mockResolvedValue({})
    render(
      <NewTaskModal
        workspaceId={null}
        hideLinks
        lockedVisibility="team"
        brands={BRANDS}
        // The agency hasn't shared anyone with this client yet.
        members={[]}
        stages={[]}
        onCreate={onCreate}
        onClose={vi.fn()}
      />,
    )
    await user.type(screen.getByPlaceholderText('Task title…'), 'No roster')
    await user.click(screen.getByRole('button', { name: 'Add task' }))
    expect(onCreate).toHaveBeenCalledTimes(1)
  })
})
