import { NextRequest } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase-server'

const tokenSchema = z.string().uuid()

/** Minimal branded confirmation page returned after an unsubscribe click. */
function page(message: string): Response {
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Email alerts</title>
<style>
  body{margin:0;background:#f5f5f4;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#292524}
  .card{max-width:420px;margin:64px auto;background:#fff;border:1px solid #e7e5e4;border-radius:12px;padding:32px;text-align:center}
  h1{font-size:20px;letter-spacing:-.02em;margin:0 0 12px}
  p{font-size:15px;line-height:24px;color:#57534e;margin:0}
</style></head>
<body><div class="card"><h1>Fey</h1><p>${message}</p></div></body></html>`
  return new Response(html, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } })
}

/**
 * GET /api/v1/notifications/unsubscribe?token=<uuid>
 *
 * Turns off chat-message email alerts for the member identified by the
 * unsubscribe token. Returns a friendly confirmation page regardless of
 * whether the token matched, to avoid leaking which tokens are valid.
 */
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('token')
  const parsed = tokenSchema.safeParse(raw)
  if (!parsed.success) {
    return page('This unsubscribe link is invalid or has expired.')
  }

  try {
    const db = createServiceClient()
    await db
      .from('notification_preferences')
      .update({ chat_messages: false, updated_at: new Date().toISOString() })
      .eq('unsubscribe_token', parsed.data)
  } catch {
    // Best-effort — never surface internal errors on a public unsubscribe page.
  }

  return page('You’ve been unsubscribed from chat message alerts. You can turn them back on anytime in your settings.')
}
