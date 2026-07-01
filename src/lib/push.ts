import crypto from 'crypto'
import webpush from 'web-push'
import { env } from '@/config/env'
import type { PushSubscriptionJSON } from '@/types/notification'

/**
 * Web Push sender. Configured lazily from VAPID env on first use. If the keys
 * aren't set, sending is a no-op (in-app notifications still work). Returns the
 * endpoints that are gone (HTTP 404/410) so the caller can prune them.
 */

let configured = false
function ensureConfigured(): boolean {
  if (configured) return true
  const pub = env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const priv = env.VAPID_PRIVATE_KEY
  if (!pub || !priv) return false
  webpush.setVapidDetails(env.VAPID_SUBJECT ?? 'mailto:admin@theruff.agency', pub, priv)
  configured = true
  return true
}

export interface PushPayload {
  title: string
  body: string
  url: string
  tag?: string
}

export async function sendPush(
  subscriptions: PushSubscriptionJSON[],
  payload: PushPayload,
): Promise<{ staleEndpoints: string[] }> {
  const staleEndpoints: string[] = []
  if (!ensureConfigured() || subscriptions.length === 0) return { staleEndpoints }

  const body = JSON.stringify(payload)
  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(sub, body)
      } catch (err) {
        const status = (err as { statusCode?: number; body?: string }).statusCode
        if (status === 404 || status === 410) {
          staleEndpoints.push(sub.endpoint)
          return
        }
        // Best-effort — never throws — but still visible in logs so delivery
        // failures (VAPID mismatch, bad payload, etc.) aren't invisible.
        const endpointHash = crypto.createHash('sha256').update(sub.endpoint).digest('hex').slice(0, 12)
        const responseBody = (err as { body?: string }).body
        console.warn('[push] send failed', { status, endpointHash, body: responseBody?.slice(0, 200) })
      }
    }),
  )
  return { staleEndpoints }
}
