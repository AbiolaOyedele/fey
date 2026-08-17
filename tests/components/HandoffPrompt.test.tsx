import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import HandoffPrompt from '@/components/tasks/HandoffPrompt'

/**
 * Regression cover for a bug that reached production.
 *
 * The task drawer closes itself on a mousedown against its backdrop. This sheet
 * mounts inside it, so pressing a teammate's name tore the drawer down
 * mid-press and the click never landed — the prompt appeared, took the tap, and
 * left the task exactly where it was. Nothing in a type check or a build can
 * see that; it only exists once a pointer goes down.
 *
 * The first test is the bug itself. The rest guard the behaviour around it, so
 * a future refactor can't quietly restore the trap.
 */

const MEMBERS = [
  { user_id: 'u1', name: 'Ada Lovelace', email: 'ada@example.com' },
  { user_id: 'u2', name: null, email: 'tunde@example.com' },
]

function renderInMousedownClosingHost(onChoose = vi.fn(), onCancel = vi.fn()) {
  const hostClose = vi.fn()
  render(
    // Mirrors TaskDetailDrawer: a backdrop that closes on mousedown, with the
    // sheet mounted as a sibling of the panel that stops the event.
    <div onMouseDown={hostClose} data-testid="host">
      <div onMouseDown={(e) => e.stopPropagation()}>drawer panel</div>
      <HandoffPrompt
        taskTitle="Design the homepage"
        stageName="Copy"
        currentHolderId="u1"
        workspaceId={null}
        members={MEMBERS}
        onChoose={onChoose}
        onCancel={onCancel}
      />
    </div>,
  )
  return { hostClose }
}

describe('HandoffPrompt', () => {
  it('does not close a host that closes on backdrop mousedown', async () => {
    const user = userEvent.setup()
    const onChoose = vi.fn()
    const { hostClose } = renderInMousedownClosingHost(onChoose)

    await user.click(screen.getByRole('button', { name: /Ada Lovelace/ }))

    // The bug: the host tore down mid-press, so the choice was swallowed.
    expect(hostClose).not.toHaveBeenCalled()
    expect(onChoose).toHaveBeenCalledWith('u1')
  })

  it('reports the person chosen, not the person who already holds it', async () => {
    const user = userEvent.setup()
    const onChoose = vi.fn()
    renderInMousedownClosingHost(onChoose)

    await user.click(screen.getByRole('button', { name: /tunde@example\.com/ }))

    expect(onChoose).toHaveBeenCalledTimes(1)
    expect(onChoose).toHaveBeenCalledWith('u2')
  })

  it('names the task and the stage it is moving to', () => {
    renderInMousedownClosingHost()
    expect(screen.getByText(/Design the homepage/)).toBeInTheDocument()
    expect(screen.getByText(/to Copy/)).toBeInTheDocument()
  })

  it('marks who currently holds the task', () => {
    renderInMousedownClosingHost()
    expect(screen.getByText('has it now')).toBeInTheDocument()
  })

  it('cancels without choosing anyone', async () => {
    const user = userEvent.setup()
    const onChoose = vi.fn()
    const onCancel = vi.fn()
    renderInMousedownClosingHost(onChoose, onCancel)

    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onCancel).toHaveBeenCalled()
    expect(onChoose).not.toHaveBeenCalled()
  })

  it('says so when there is nobody to hand the work to', () => {
    render(
      <HandoffPrompt
        taskTitle="Design the homepage"
        stageName="Copy"
        currentHolderId={null}
        workspaceId={null}
        members={[]}
        onChoose={vi.fn()}
        onCancel={vi.fn()}
      />,
    )
    // An empty list must explain itself rather than render a blank sheet.
    expect(screen.getByText(/No teammates to hand this to yet/)).toBeInTheDocument()
  })
})
