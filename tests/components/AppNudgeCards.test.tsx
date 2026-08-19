import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
import AppNudgeCards from '@/components/pwa/AppNudgeCards'
import type { PushController } from '@/hooks/usePush'

/**
 * The nudges are shared by the app and by every client portal, and the thing
 * that must not slip is the branding: a client portal is white-labelled, so
 * offering a client "Install Fey" would name a product they have never heard
 * of. The snooze keys are namespaced for the same reason — dismissing the card
 * in one agency's portal shouldn't silence it in another's.
 */

const SHOW_DELAY_MS = 4000

function controller(over: Partial<PushController> = {}): PushController {
  return {
    supported: true,
    permission: 'default',
    subscribed: false,
    busy: false,
    subscribe: vi.fn().mockResolvedValue(undefined),
    unsubscribe: vi.fn().mockResolvedValue(undefined),
    ...over,
  }
}

/** Nothing shows for the first few seconds; this gets past that. */
async function settle() {
  await act(async () => { await vi.advanceTimersByTimeAsync(SHOW_DELAY_MS + 50) })
}

beforeEach(() => {
  vi.useFakeTimers()
  localStorage.clear()
})
afterEach(() => { vi.useRealTimers() })

describe('AppNudgeCards', () => {
  it('says nothing at all for the first few seconds', () => {
    const { container } = render(
      <AppNudgeCards push={controller()} appName="Velvet Social" storageKey="portal:internal" pushReason="Updates." />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('offers the agency by name, never Fey', async () => {
    render(
      <AppNudgeCards
        push={controller()}
        appName="Velvet Social"
        storageKey="portal:internal"
        pushReason="Get alerts for messages, files and updates from Velvet Social."
      />,
    )
    await settle()
    expect(screen.getByText('Turn on notifications')).toBeInTheDocument()
    expect(screen.getByText(/Velvet Social/)).toBeInTheDocument()
    expect(screen.queryByText(/Fey/)).not.toBeInTheDocument()
  })

  it('subscribes when the client accepts', async () => {
    const push = controller()
    render(<AppNudgeCards push={push} appName="Velvet Social" storageKey="portal:internal" pushReason="Updates." />)
    await settle()
    // fireEvent, not userEvent: its pointer sequence waits on real timers, which
    // never advance here.
    fireEvent.click(screen.getByRole('button', { name: 'Enable notifications' }))
    expect(push.subscribe).toHaveBeenCalledTimes(1)
  })

  it('stays quiet once notifications are already on', async () => {
    const { container } = render(
      <AppNudgeCards push={controller({ subscribed: true })} appName="X" storageKey="k" pushReason="Updates." />,
    )
    await settle()
    expect(container).toBeEmptyDOMElement()
  })

  it('stays quiet when the browser can’t do it, or the answer was already no', async () => {
    for (const push of [controller({ supported: false }), controller({ permission: 'denied' })]) {
      const { container, unmount } = render(
        <AppNudgeCards push={push} appName="X" storageKey="k" pushReason="Updates." />,
      )
      await settle()
      expect(container).toBeEmptyDOMElement()
      unmount()
    }
  })

  it('snoozes under its own key, so one portal cannot silence another', async () => {
    const { unmount } = render(
      <AppNudgeCards push={controller()} appName="Velvet Social" storageKey="portal:internal" pushReason="Updates." />,
    )
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss Turn on notifications' }))
    unmount()

    // A different portal on the same device is untouched.
    render(<AppNudgeCards push={controller()} appName="Other Agency" storageKey="portal:other" pushReason="Updates." />)
    await settle()
    expect(screen.getByText('Turn on notifications')).toBeInTheDocument()
  })
})
