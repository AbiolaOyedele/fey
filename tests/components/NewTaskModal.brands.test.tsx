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
    await user.click(screen.getByRole('button', { name: 'Add task' }))

    expect(onCreate).toHaveBeenCalledTimes(1)
    expect(onCreate.mock.calls[0]![0]).toMatchObject({ title: 'New billboard', project_id: 'p2' })
  })

  it('sends no brand when none is chosen', async () => {
    const user = userEvent.setup()
    const onCreate = renderPortalSheet()

    await user.type(screen.getByPlaceholderText('Task title…'), 'Unfiled')
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
