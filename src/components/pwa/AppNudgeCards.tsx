'use client'

import { useState, useEffect, useCallback } from 'react'
import { Download, Bell, X, Share } from 'lucide-react'
import type { PushController } from '@/hooks/usePush'

/**
 * Gentle, periodic nudges to (1) install the app and (2) enable notifications.
 * Shows at most one card at a time, a few seconds after load, only when relevant
 * (not already installed / subscribed / blocked). Dismissing snoozes it for a
 * week, so it nudges again later rather than nagging every visit.
 *
 * Shared by the app and by every client portal. The two differ in three ways —
 * what the thing is called, where a subscription is stored, and whose accent
 * colour the button wears — so those are props, and the behaviour around them
 * is written once. A client portal is a white-labelled product: it must offer
 * to install the agency's portal, never "Fey".
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000
const SHOW_DELAY_MS = 4000

export interface AppNudgeCardsProps {
  /** Push implementation for this surface — the app's, or a portal's. */
  push: PushController
  /** What the installed thing is called, in the client's own words. */
  appName: string
  /**
   * Namespaces the snooze keys. Without it, dismissing the nudge in one portal
   * would silence it in the app and in every other agency's portal too.
   */
  storageKey: string
  /** What arrives by notification here — the reason to say yes. */
  pushReason: string
}

function isSnoozed(key: string): boolean {
  try { return Date.now() < Number(localStorage.getItem(key) || 0) } catch { return false }
}
function snooze(key: string): void {
  try { localStorage.setItem(key, String(Date.now() + SNOOZE_MS)) } catch { /* unavailable */ }
}

export default function AppNudgeCards({ push, appName, storageKey, pushReason }: AppNudgeCardsProps) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [standalone, setStandalone] = useState(true)   // assume installed until proven otherwise (no flash)
  const [ready, setReady] = useState(false)
  const [hidden, setHidden] = useState<{ install: boolean; push: boolean }>({ install: false, push: false })

  useEffect(() => {
    if (typeof window === 'undefined') return
    const standaloneNow =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true
    // Whether the app is already installed is a fact about the window, not
    // something render can compute — and it's read once on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStandalone(standaloneNow)

    const onBIP = (e: Event) => { e.preventDefault(); setDeferred(e as BeforeInstallPromptEvent) }
    const onInstalled = () => setStandalone(true)
    window.addEventListener('beforeinstallprompt', onBIP)
    window.addEventListener('appinstalled', onInstalled)
    const t = setTimeout(() => setReady(true), SHOW_DELAY_MS)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBIP)
      window.removeEventListener('appinstalled', onInstalled)
      clearTimeout(t)
    }
  }, [])

  const isIOS = typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent)

  const showInstall = ready && !standalone && (!!deferred || isIOS) && !hidden.install && !isSnoozed(`${storageKey}:nudge_install`)
  const showPush = ready && !showInstall && push.supported && !push.subscribed && push.permission === 'default' && !hidden.push && !isSnoozed(`${storageKey}:nudge_push`)

  const installNow = useCallback(async () => {
    if (!deferred) return
    await deferred.prompt()
    await deferred.userChoice.catch(() => undefined)
    setDeferred(null)
    setHidden((h) => ({ ...h, install: true }))
  }, [deferred])

  const dismissInstall = useCallback(() => { snooze(`${storageKey}:nudge_install`); setHidden((h) => ({ ...h, install: true })) }, [storageKey])
  const dismissPush = useCallback(() => { snooze(`${storageKey}:nudge_push`); setHidden((h) => ({ ...h, push: true })) }, [storageKey])

  if (!showInstall && !showPush) return null

  return (
    <div className="fixed z-40 left-3 right-3 bottom-20 lg:left-auto lg:right-4 lg:bottom-4 lg:w-80">
      {showInstall ? (
        <Card
          icon={<Download size={18} />}
          title={`Install ${appName}`}
          onDismiss={dismissInstall}
        >
          {isIOS && !deferred ? (
            <p className="text-xs2 text-gray-500">
              Tap <Share size={12} className="inline -mt-0.5" /> then <span className="font-medium">Add to Home Screen</span> to install.
            </p>
          ) : (
            <>
              <p className="text-xs2 text-gray-500 mb-2.5">Add {appName} to your home screen for quick, full-screen access.</p>
              <button
                onClick={() => void installNow()}
                className="w-full py-2 rounded-full text-xs2 font-semibold text-white hover:opacity-90"
                style={{ backgroundColor: 'var(--accent, #ED64A6)' }}
              >
                Install
              </button>
            </>
          )}
        </Card>
      ) : (
        <Card
          icon={<Bell size={18} />}
          title="Turn on notifications"
          onDismiss={dismissPush}
        >
          <p className="text-xs2 text-gray-500 mb-2.5">{pushReason}</p>
          <button
            onClick={() => { void push.subscribe(); setHidden((h) => ({ ...h, push: true })) }}
            disabled={push.busy}
            className="w-full py-2 rounded-full text-xs2 font-semibold text-white hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: 'var(--accent, #ED64A6)' }}
          >
            Enable notifications
          </button>
        </Card>
      )}
    </div>
  )
}

function Card({ icon, title, children, onDismiss }: {
  icon: React.ReactNode; title: string; children: React.ReactNode; onDismiss: () => void
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-xl p-4 animate-fadeIn">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-gray-900 text-white flex items-center justify-center flex-shrink-0">{icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-900">{title}</p>
            <button onClick={onDismiss} aria-label={`Dismiss ${title}`} className="tap-target text-gray-300 hover:text-gray-500 -mr-1"><X size={15} /></button>
          </div>
          <div className="mt-1">{children}</div>
        </div>
      </div>
    </div>
  )
}
