'use client'

import { useEffect } from 'react'
import AppNudgeCards from '@/components/pwa/AppNudgeCards'
import PwaRegister from '@/components/pwa/PwaRegister'
import { usePortalPush } from '@/hooks/usePortalPush'
import { portalBasePath } from '@/hooks/usePortalBase'

interface PortalAppNudgesProps {
  subdomain: string
  /** The agency's name — what the client is being offered, in their words. */
  businessName: string
}

/**
 * Install and notification nudges for a client portal.
 *
 * Same cards the app shows, three things different: it offers the agency's
 * portal rather than Fey, notifications go through the portal's own endpoint
 * because a client isn't an auth user, and the snooze is namespaced per
 * workspace so dismissing it in one portal doesn't silence it everywhere.
 */
export default function PortalAppNudges({ subdomain, businessName }: PortalAppNudgesProps) {
  const push = usePortalPush(subdomain)

  // The manifest has to be linked relative to how this device reaches the
  // portal — /client on the agency's subdomain, /portal/<slug> otherwise — so
  // that the relative start_url and scope inside it resolve to the right place.
  // That's only knowable in the browser, which is why it's set here rather than
  // in route metadata.
  useEffect(() => {
    const href = `${portalBasePath(subdomain)}/manifest.webmanifest`
    let link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]')
    if (!link) {
      link = document.createElement('link')
      link.rel = 'manifest'
      document.head.appendChild(link)
    }
    const previous = link.getAttribute('href')
    link.href = href
    // Put the app's own manifest back on the way out, so a signed-in owner who
    // navigates from a portal preview into the dashboard isn't offered the
    // client portal as the thing to install.
    return () => {
      if (previous) link.setAttribute('href', previous)
    }
  }, [subdomain])

  return (
    <>
      {/* The portal never registered one — it mounts outside AppShell — so
          beforeinstallprompt could never fire here and there was nothing for a
          push subscription to attach to. */}
      <PwaRegister />
      <AppNudgeCards
        push={push}
        appName={businessName}
        storageKey={`portal:${subdomain}`}
        pushReason={`Get alerts for messages, files and updates from ${businessName} — even when this is closed.`}
      />
    </>
  )
}
