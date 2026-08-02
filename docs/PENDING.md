# Pending items

Updated 2026-08-04. Everything from the client-portal, chat and CRM batches is
built. What's left is verification and one decision.

---

## Needs you

### 1. Confirm the private-chat promise
The portal's **Team chat** is private *from the agency*: `portal_team_messages`
has RLS enabled and **no policy at all**, so nothing but the portal's own API can
read it — not the owner, not an admin, not the CRM. The page says so in plain
words at the top.

That was the reading of "so that clients can chat privately". If you actually
want to be able to see those conversations, say so — it's a policy plus a CRM
tab, and it's much easier to change now than after clients start using it.

### 2. Your logo is still empty
`fey_settings.logo` is blank for your workspace, which is why the portal shows a
letter instead of a mark. Upload it under **Settings → Logo & cover** (not the
profile-photo field — clients never see that one).

Your `avatar_url` still holds a 287 KB base64 image, but it no longer costs
anything on portal load — see below.

### 3. Check it on a phone
Nothing here has been opened in a browser. It's all written mobile-first with
44px tap targets, but that's a claim, not a check. Worth 10 minutes on the portal
Tasks page and Team chat.

---

## Built and verified (typecheck + build clean)

**Migrations** — both applied and verified against the live database:
[20260803_chat_whatsapp_parity.sql](../supabase/migrations/20260803_chat_whatsapp_parity.sql),
[20260804_portal_tasks_and_team.sql](../supabase/migrations/20260804_portal_tasks_and_team.sql).

**Security** — `requireCapability()` gates every portal write path and reads the
role fresh from the database, so a 30-day token can't outlive a demotion. A
viewer can no longer sign a contract through the API.

**Portal** — Tasks rebuilt in the app's language with client-created and
client-assigned tasks; team-access control (opt-in, so a portal never leaks your
roster); members can be added, given roles and removed, with invite emails;
self-service rename; compact settings; all seven section pages restyled.

**Chat parity** — tombstones, delete-for-everyone (48h, admins any time),
delete-for-me, edit windows, replies with quoted previews, and emoji reactions.
Across internal chat, CRM messages, and the portal's private room.

**Notifications** — all six portal toggles now fire. Invoices, payments and tasks
were dead before.

**Performance** — the portal's session check was doing `select('*')` on
`fey_settings`, dragging base64 avatar and cover images into every page load.
Narrowed to the columns the portal renders. New logo uploads go to Cloudinary;
[scripts/migrate-logos-to-cloudinary.mjs](../scripts/migrate-logos-to-cloudinary.mjs)
moves any old inline ones (dry run says there are none left).

---

## Known limits, deliberately

- **Brand chat** (`/projects/[id]`) uses its own table without the unsend/reply
  columns, so those controls don't appear there. Left alone rather than
  half-migrated.
- **Clients can only tick off tasks they raised themselves.** Closing agency work
  isn't theirs to decide.
- **Client emails can't be changed from the portal** — email is the login
  identity and changing it needs a verification flow.
