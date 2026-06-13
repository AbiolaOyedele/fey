# fey

## Email & alerts

All outbound transactional email goes through a single service —
`src/services/email.service.ts` (one Resend instance, best-effort sends).
Templates are React Email components in `emails/`. Preview them locally:

```bash
npm run email   # opens the React Email preview on http://localhost:3030
```

### Environment variables

| Variable | Purpose |
|---|---|
| `RESEND_API_KEY` | Resend key. While unset, sends are skipped (no crash). |
| `EMAIL_WEBHOOK_SECRET` | Shared secret for the chat-alert webhook (min 16 chars). While unset, the notify endpoint rejects every request. Generate: `openssl rand -base64 24`. |
| `NEXT_PUBLIC_APP_URL` | Public base URL used to build links in alert emails (falls back to `NEXT_PUBLIC_ROOT_DOMAIN`). |

### Alert emails

| Event | Trigger | Recipient |
|---|---|---|
| Workspace invite | `POST /api/v1/team/invites` | invitee |
| Invite accepted | `POST /api/v1/team/invites/accept` | inviter |
| Role changed | `PATCH /api/v1/team/members/[id]` | the member |
| New chat message | Supabase DB webhook (below) | other workspace members (debounced 5 min) |

Members can opt out of chat-message alerts via the unsubscribe link in the
email (`/api/v1/notifications/unsubscribe?token=…`), stored in
`notification_preferences`.

### Wiring the chat-message webhook

Internal-chat messages are inserted client-side, so the alert is driven by a
Supabase Database Webhook rather than an app route. Apply the migration
`supabase/migrations/20260613_email_alerts.sql`, then in the Supabase Dashboard:

**Database → Webhooks → Create a new hook**
- Table: `internal_messages`
- Events: `INSERT`
- Type: HTTP Request → `POST`
- URL: `https://<your-app-host>/api/v1/internal/messages/notify`
- HTTP Header: `x-webhook-secret: <EMAIL_WEBHOOK_SECRET>`

A pure-SQL `pg_net` trigger alternative is included (commented) in that
migration file.
