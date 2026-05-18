# WorkBoard WhatsApp Bot

A lightweight Express webhook server that lets you add tasks to WorkBoard by sending a WhatsApp message to a Twilio number.

---

## How it works

1. You send a WhatsApp message to your Twilio number.
2. The bot looks up your phone number in Supabase to confirm it's connected and verified.
3. It parses an optional date override from your message (e.g. "add to yesterday, ...").
4. It finds or creates a task group named after that date (e.g. "May 18").
5. It calls Claude Haiku once to extract individual task titles from your message.
6. It inserts the tasks into `standalone_tasks` in Supabase.
7. It replies to you on WhatsApp with a confirmation.

---

## Message format

**Basic** — tasks added to today's group:
```
Write intro for blog post, update invoice template, email John about project
```

**With date override** — tasks added to a specific day's group:
```
add to yesterday, write intro for blog post, update invoice template
add to May 16, email John about project
add to last Monday, review Q2 report
```

---

## Local development

### 1. Install dependencies

```bash
cd bot
npm install
```

### 2. Set up environment variables

```bash
cp .env.example .env
```

Fill in all values in `.env` (see the section below).

### 3. Expose your local server to the internet

Twilio needs a public URL to send webhook requests. Use [ngrok](https://ngrok.com):

```bash
npx ngrok http 3001
```

Copy the HTTPS URL it gives you (e.g. `https://abc123.ngrok.io`).

### 4. Configure the Twilio sandbox webhook

1. Go to [Twilio Console → Messaging → Try it out → Send a WhatsApp message](https://console.twilio.com/us1/develop/sms/try-it-out/whatsapp-learn).
2. Under **Sandbox Configuration**, set **When a message comes in** to:
   ```
   https://abc123.ngrok.io/webhook
   ```
3. Save.

### 5. Run the server

```bash
npm run dev
```

---

## Environment variables

| Variable | Description |
|---|---|
| `TWILIO_ACCOUNT_SID` | From your Twilio Console dashboard |
| `TWILIO_AUTH_TOKEN` | From your Twilio Console dashboard |
| `TWILIO_WHATSAPP_NUMBER` | Your Twilio WhatsApp number, **without** the `whatsapp:` prefix — e.g. `+14155238886` |
| `ANTHROPIC_API_KEY` | From [console.anthropic.com](https://console.anthropic.com) |
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | The **service role** key — not the anon key. Found in Supabase → Project Settings → API |
| `PORT` | Optional. Defaults to `3001`. Railway sets this automatically. |

---

## Deploying to Railway

### 1. Create a Railway project

1. Go to [railway.app](https://railway.app) and create a new project.
2. Choose **Deploy from GitHub repo**.
3. Select your WorkBoard repository.

### 2. Set the root directory

Railway will detect the repo root by default. You need to point it to the `/bot` subfolder:

1. In your Railway service, go to **Settings → Source**.
2. Set **Root Directory** to `bot`.

### 3. Set environment variables

In Railway → your service → **Variables**, add every variable from the table above (all except `PORT` — Railway sets that automatically).

### 4. Deploy

Railway deploys automatically on every push to your connected branch. Once deployed, copy the public URL Railway assigns to your service (e.g. `https://workboard-bot.up.railway.app`).

### 5. Configure Twilio webhook (production)

In Twilio Console → your WhatsApp number → **Messaging Configuration**, set the webhook URL to:
```
https://workboard-bot.up.railway.app/webhook
```

### 6. Configure the React frontend

Add the bot URL to your frontend environment:

In your WorkBoard `.env.local` (and in Vercel environment variables for production):
```
VITE_BOT_URL=https://workboard-bot.up.railway.app
```

---

## Twilio Sandbox note

In the Twilio **sandbox**, only numbers that have explicitly joined the sandbox can receive messages. Each user must text **"join <your-sandbox-keyword>"** to the sandbox number once before the bot can message them.

In production (with a purchased Twilio number and approved WhatsApp Business sender), this restriction does not apply.

---

## API endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/webhook` | Twilio inbound message webhook |
| `POST` | `/verify/send` | Send a 6-digit verification code to a phone number |
| `POST` | `/verify/confirm` | Confirm a verification code and mark the number as verified |
| `GET` | `/health` | Health check — returns `{ ok: true }` |

---

## Cost profile

- **Claude Haiku** — called once per inbound message, for task extraction only. No system prompt, no history. Approximately $0.0001–$0.0003 per message.
- **Twilio** — standard WhatsApp messaging rates apply per message sent/received.
- **Supabase** — reads/writes are minimal (2–4 queries per message).
