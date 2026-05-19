import 'dotenv/config';
import * as Sentry from '@sentry/node';
import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import twilio from 'twilio';
import ws from 'ws';

Sentry.init({ dsn: process.env.SENTRY_DSN, tracesSampleRate: 0.2 });
import {
  format,
  parse,
  subDays,
  previousDay,
  startOfDay,
  isValid,
} from 'date-fns';

// ── Clients ───────────────────────────────────────────────────────────────────

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { realtime: { transport: ws } },
);

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN,
);

// ── Constants ─────────────────────────────────────────────────────────────────

// date-fns Day enum: 0=Sun 1=Mon 2=Tue 3=Wed 4=Thu 5=Fri 6=Sat
const DAY_MAP = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
  thursday: 4, friday: 5, saturday: 6,
};

// ── Reply builder ─────────────────────────────────────────────────────────────

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function buildReply(tasks, heading) {
  const n = tasks.length;
  const deadlineCount = tasks.filter((t) => t.deadline).length;

  const sharedOpeners = [`Got it.`, `Noted.`, `Done.`, `On it.`];
  const opener = n === 1
    ? pick([...sharedOpeners, `Logged.`, `Sure thing.`])
    : pick([...sharedOpeners, `All logged.`, `Sorted.`, `Consider it done.`]);

  const captured = n === 1
    ? pick([
        `Pulled 1 task from that`,
        `Found 1 task in there`,
        `Got 1 thing from that`,
        `Picked out 1 task`,
        `1 task captured`,
      ])
    : pick([
        `Pulled ${n} tasks from that`,
        `Found ${n} tasks in there`,
        `Got ${n} things from that`,
        `Picked out ${n} tasks`,
        `${n} tasks captured`,
        `${n} things logged`,
      ]);

  const deadlineNote = deadlineCount === 1
    ? pick([
        `One has a deadline, so don't leave it too long.`,
        `One's time-sensitive — worth checking soon.`,
        `There's a deadline on one of them.`,
        `One of them has a date attached — keep an eye on it.`,
        `Heads up, one has a deadline.`,
      ])
    : pick([
        `${deadlineCount} have deadlines, worth checking soon.`,
        `${deadlineCount} are time-sensitive.`,
        `Watch those ${deadlineCount} — they have dates attached.`,
        `${deadlineCount} of them have deadlines coming up.`,
      ]);

  if (deadlineCount > 0) {
    return `${opener} ${captured} — "${heading}". ${deadlineNote}`;
  }

  if (Math.random() < 0.33) {
    const checkIn = pick([
      `Check Fey when you're ready.`,
      `Open Fey to review.`,
      `Head to Fey when you're free.`,
      `It's all in Fey.`,
      `You'll find it all in Fey.`,
    ]);
    return `${opener} ${captured} — "${heading}". ${checkIn}`;
  }

  return `${opener} ${captured} — "${heading}".`;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizePhone(raw) {
  const phone = String(raw).replace(/^whatsapp:/i, '').trim();
  return phone.startsWith('+') ? phone : `+${phone}`;
}

/**
 * Parses an optional date override from the message body.
 * Supported phrases: "yesterday", "today", "last <weekday>", "<Month> <day>" (e.g. "May 16").
 * Returns { date: Date, body: string } — body is the message with the prefix stripped.
 * Falls back to today if no override is detected or the phrase is unrecognised.
 */
function parseDateOverride(message) {
  const re = /^add\s+to\s+(yesterday|today|last\s+\w+|[A-Za-z]+\s+\d{1,2})[,\s\n]+([\s\S]+)/i;
  const match = message.trim().match(re);

  if (!match) return { date: startOfDay(new Date()), body: message.trim() };

  const phrase = match[1].trim().toLowerCase();
  const body = match[2].trim();
  const today = startOfDay(new Date());

  if (phrase === 'today') return { date: today, body };
  if (phrase === 'yesterday') return { date: subDays(today, 1), body };

  if (phrase.startsWith('last ')) {
    const dayName = phrase.slice(5).trim();
    const dayNum = DAY_MAP[dayName];
    if (dayNum !== undefined) {
      return { date: previousDay(today, dayNum), body };
    }
  }

  // "May 16", "June 3", etc. — parse against current year
  const parsed = parse(match[1].trim(), 'MMM d', today);
  if (isValid(parsed)) return { date: parsed, body };

  return { date: today, body };
}

/**
 * Calls Claude Haiku to analyze a message.
 * Returns { heading: string, tasks: { title, notes, deadline }[] }.
 * Strips markdown code fences before parsing. Throws on invalid JSON.
 */
async function analyzeMessage(message, date) {
  const today = format(date, 'yyyy-MM-dd');

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: `Today is ${today}. Analyze this WhatsApp message and return JSON only (no explanation) with:
- "heading": a short 3-6 word title summarizing the message topic
- "tasks": array of { "title": string, "notes": string|null, "deadline": "YYYY-MM-DD"|null }

Rules:
- Extract every actionable item, reminder, or thing that needs to be done or followed up on.
- If the message contains a URL or link, treat it as a task to review or follow up on. Include the full URL in the notes field.
- notes: 1-2 sentences of context or relevant detail (include URLs here if present). null if there is nothing useful to add.
- deadline: convert relative terms (tomorrow, next Friday, end of week, etc.) to absolute ISO dates based on today. null if not mentioned.
- If the message has no clear tasks but contains a link, create a task like "Review link" or "Check [platform] post" with the URL in notes.

Message: "${message}"`,
    }],
  });

  const text = response.content[0].text.trim();
  const cleaned = text.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
  return JSON.parse(cleaned);
}

// ── Express app ───────────────────────────────────────────────────────────────

const app = express();
app.use(cors());
app.use(express.urlencoded({ extended: false })); // Twilio sends URL-encoded form data
app.use(express.json());

// ── POST /webhook — inbound WhatsApp messages from Twilio ─────────────────────

app.post('/webhook', async (req, res) => {
  const twiml = new twilio.twiml.MessagingResponse();
  const reply = (msg) => {
    twiml.message(msg);
    res.type('text/xml').send(twiml.toString());
  };

  try {
    const fromRaw = req.body.From || '';
    const messageBody = (req.body.Body || '').trim();
    const phone = normalizePhone(fromRaw);

    if (!messageBody) return reply('❌ Empty message received. Try again.');

    // ── 1. Verify sender ────────────────────────────────────────────────────
    const { data: connection } = await supabase
      .from('whatsapp_connections')
      .select('user_id, verified')
      .eq('phone_number', phone)
      .maybeSingle();

    if (!connection) {
      return reply(
        "Your WhatsApp number isn't connected to WorkBoard. Go to Settings to connect.",
      );
    }
    if (!connection.verified) {
      return reply("Your number isn't verified yet. Check WorkBoard settings.");
    }

    const { user_id } = connection;

    // ── 2. Parse date override ──────────────────────────────────────────────
    const { date, body } = parseDateOverride(messageBody);

    // ── 3+4. Analyze message and look up today's thread concurrently ────────
    const dateStr = format(date, 'yyyy-MM-dd');

    const [{ heading, tasks }, { data: existingThread, error: lookupError }] = await Promise.all([
      analyzeMessage(body, date),
      supabase
        .from('fey_threads')
        .select('id')
        .eq('user_id', user_id)
        .eq('message_date', dateStr)
        .maybeSingle(),
    ]);

    if (lookupError) throw lookupError;

    if (!Array.isArray(tasks) || tasks.length === 0) {
      return reply("❌ Couldn't extract any tasks from your message. Try again.");
    }

    let threadId;

    if (existingThread) {
      threadId = existingThread.id;
    } else {
      const { data: newThread, error: threadError } = await supabase
        .from('fey_threads')
        .insert({
          user_id,
          raw_message: body,
          heading: String(heading || body).slice(0, 120),
          message_date: dateStr,
        })
        .select('id')
        .single();

      if (threadError) throw threadError;
      threadId = newThread.id;
    }

    // ── 5. Insert tasks ─────────────────────────────────────────────────────
    const { count: existingCount } = await supabase
      .from('fey_tasks')
      .select('*', { count: 'exact', head: true })
      .eq('thread_id', threadId);

    const rows = tasks.slice(0, 20).map((task, i) => ({
      thread_id: threadId,
      user_id,
      title: String(task.title || '').trim(),
      notes: task.notes ? String(task.notes).trim() : null,
      deadline: task.deadline || null,
      done: false,
      sort_order: (existingCount ?? 0) + i,
    }));

    const { error: insertError } = await supabase.from('fey_tasks').insert(rows);
    if (insertError) throw insertError;

    return reply(buildReply(rows, heading));
  } catch (err) {
    Sentry.captureException(err);
    console.error('[webhook]', err);

    // Anthropic SDK errors carry an HTTP .status; Supabase errors don't
    const isClaudeError = typeof err?.status === 'number';
    // Supabase errors are plain objects with a .code string and a .details field
    const isDbError = !isClaudeError && typeof err?.code === 'string' && err?.details !== undefined;
    const isParseError = err instanceof SyntaxError;

    if (isClaudeError) {
      return reply('Fey is down a bit. Try again in a moment.');
    }
    if (isDbError) {
      return reply("Fey received your message but couldn't save it. Try again.");
    }
    if (isParseError) {
      return reply("Fey couldn't make sense of your message. Try rephrasing it.");
    }
    return reply("Something went wrong on our end. Try again shortly.");
  }
});

// ── POST /verify/send — send a 6-digit code to the user's WhatsApp ────────────

app.post('/verify/send', async (req, res) => {
  try {
    const { phone_number, user_id } = req.body;
    if (!phone_number || !user_id) {
      return res.status(400).json({ error: 'phone_number and user_id are required.' });
    }

    const phone = normalizePhone(phone_number);
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    // Clear any existing code for this number
    await supabase.from('verification_codes').delete().eq('phone_number', phone);

    // Store the new code
    const { error: codeError } = await supabase
      .from('verification_codes')
      .insert({ phone_number: phone, code, expires_at: expiresAt });
    if (codeError) throw codeError;

    // Upsert a pending connection record
    const { error: connError } = await supabase
      .from('whatsapp_connections')
      .upsert(
        { user_id, phone_number: phone, verified: false },
        { onConflict: 'user_id' },
      );
    if (connError) throw connError;

    // Send the code via Twilio WhatsApp
    await twilioClient.messages.create({
      from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
      to: `whatsapp:${phone}`,
      body: `Your WorkBoard verification code is: ${code}. It expires in 10 minutes.`,
    });

    return res.json({ ok: true });
  } catch (err) {
    Sentry.captureException(err);
    console.error('[verify/send]', err);
    return res.status(500).json({ error: 'Failed to send verification code. Try again.' });
  }
});

// ── POST /verify/confirm — confirm the code and mark the number as verified ───

app.post('/verify/confirm', async (req, res) => {
  try {
    const { phone_number, code } = req.body;
    if (!phone_number || !code) {
      return res.status(400).json({ error: 'phone_number and code are required.' });
    }

    const phone = normalizePhone(phone_number);
    const now = new Date().toISOString();

    const { data: record } = await supabase
      .from('verification_codes')
      .select('code, expires_at')
      .eq('phone_number', phone)
      .maybeSingle();

    if (!record) {
      return res.status(400).json({ error: 'No verification code found. Request a new one.' });
    }
    if (record.expires_at < now) {
      return res.status(400).json({ error: 'Code expired. Request a new one.' });
    }
    if (record.code !== String(code).trim()) {
      return res.status(400).json({ error: 'Incorrect code.' });
    }

    // Mark the connection as verified
    const { error: updateError } = await supabase
      .from('whatsapp_connections')
      .update({ verified: true, connected_at: now })
      .eq('phone_number', phone);
    if (updateError) throw updateError;

    // Clean up the used code
    await supabase.from('verification_codes').delete().eq('phone_number', phone);

    return res.json({ ok: true });
  } catch (err) {
    Sentry.captureException(err);
    console.error('[verify/confirm]', err);
    return res.status(500).json({ error: 'Verification failed. Try again.' });
  }
});

// ── GET /health ───────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => res.json({ ok: true }));

// ── Start ─────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Bot server listening on port ${PORT}`));
