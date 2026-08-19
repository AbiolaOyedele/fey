import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import EmailTypoHint from '@/components/ui/EmailTypoHint'

/**
 * The hint sits under an email field and fires on every keystroke, so the thing
 * it must do most of the time is nothing at all.
 */

describe('EmailTypoHint', () => {
  it('stays silent while an address is still being typed', () => {
    const { container } = render(<EmailTypoHint value="temitopelumi@gm" onAccept={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('stays silent for an address that is simply unusual', () => {
    const { container } = render(<EmailTypoHint value="kemi@theruff.agency" onAccept={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('offers the correction for the typo that caused this', () => {
    render(<EmailTypoHint value="temitopelumi@gmail.con" onAccept={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'temitopelumi@gmail.com' })).toBeInTheDocument()
  })

  it('hands back the corrected address when tapped', async () => {
    const user = userEvent.setup()
    const onAccept = vi.fn()
    render(<EmailTypoHint value="temitopelumi@gmail.con" onAccept={onAccept} />)
    await user.click(screen.getByRole('button', { name: 'temitopelumi@gmail.com' }))
    expect(onAccept).toHaveBeenCalledWith('temitopelumi@gmail.com')
  })

  it('is a suggestion, not a gate — it cannot block a submit', () => {
    render(<EmailTypoHint value="temitopelumi@gmail.con" onAccept={vi.fn()} />)
    // type="button" so it never submits the form it sits inside, and there is
    // no disabled state on anything else to find.
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button')
  })

  it('keeps a reachable tap target on touch', () => {
    render(<EmailTypoHint value="a@gmail.con" onAccept={vi.fn()} />)
    expect(screen.getByRole('button').className).toContain('tap-target')
  })
})
