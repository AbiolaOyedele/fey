import { z } from 'zod'

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  // Optional at boot — validated at call time in the relevant routes
  RESEND_API_KEY:                     z.string().min(1).optional(),
  PAYSTACK_SECRET_KEY:                z.string().min(1).optional(),
  NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY:    z.string().min(1).optional(),
  // CRM / portal
  SUPABASE_SERVICE_ROLE_KEY:          z.string().min(1).optional(),
  // Shared secret guarding the Supabase DB webhook that triggers chat alerts.
  // While unset, the notify endpoint rejects every request (no alerts sent).
  EMAIL_WEBHOOK_SECRET:               z.string().min(16).optional(),
  NEXT_PUBLIC_ROOT_DOMAIN:            z.string().min(1).optional(),
  NEXT_PUBLIC_APP_URL:                z.string().url().optional(),
  // Portal client auth (custom JWT — not Supabase Auth)
  PORTAL_JWT_SECRET:                  z.string().min(32).optional(),
  // Build/version detection (set on Vercel). Used to prompt clients to reload
  // after a new deploy. NEXT_PUBLIC_BUILD_ID is inlined at build time.
  NEXT_PUBLIC_BUILD_ID:               z.string().optional(),
  VERCEL_GIT_COMMIT_SHA:              z.string().optional(),
  // Shared secret for the retention cron. While unset, the prune endpoint is
  // disabled — nothing is ever auto-deleted until you configure this.
  CRON_SECRET:                        z.string().min(1).optional(),
  // Cloudinary admin — used to delete attachment files during the retention sweep.
  NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME:  z.string().min(1).optional(),
  NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET: z.string().min(1).optional(),
  CLOUDINARY_API_KEY:                 z.string().min(1).optional(),
  CLOUDINARY_API_SECRET:              z.string().min(1).optional(),
  // Comma-separated allowlist of admin emails (your personal admin board +
  // feedback notifications). While unset, the admin board denies everyone and
  // feedback emails are skipped (rows are still stored).
  ADMIN_EMAILS:                       z.string().optional(),
})

const parsed = envSchema.safeParse({
  NEXT_PUBLIC_SUPABASE_URL:           process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY:      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  RESEND_API_KEY:                     process.env.RESEND_API_KEY,
  PAYSTACK_SECRET_KEY:                process.env.PAYSTACK_SECRET_KEY,
  NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY:    process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY,
  SUPABASE_SERVICE_ROLE_KEY:          process.env.SUPABASE_SERVICE_ROLE_KEY,
  EMAIL_WEBHOOK_SECRET:               process.env.EMAIL_WEBHOOK_SECRET,
  NEXT_PUBLIC_ROOT_DOMAIN:            process.env.NEXT_PUBLIC_ROOT_DOMAIN,
  NEXT_PUBLIC_APP_URL:                process.env.NEXT_PUBLIC_APP_URL,
  PORTAL_JWT_SECRET:                  process.env.PORTAL_JWT_SECRET,
  NEXT_PUBLIC_BUILD_ID:               process.env.NEXT_PUBLIC_BUILD_ID,
  VERCEL_GIT_COMMIT_SHA:              process.env.VERCEL_GIT_COMMIT_SHA,
  CRON_SECRET:                        process.env.CRON_SECRET,
  NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME:  process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY:                 process.env.CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET:              process.env.CLOUDINARY_API_SECRET,
  ADMIN_EMAILS:                       process.env.ADMIN_EMAILS,
})

if (!parsed.success) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Environment validation failed. App cannot start.')
  }
  console.warn(
    '[env] Missing or invalid environment variables. Fill in .env.local before connecting to Supabase.',
    parsed.error.flatten(),
  )
}

export const env = parsed.success
  ? parsed.data
  : {
      NEXT_PUBLIC_SUPABASE_URL:        process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
      NEXT_PUBLIC_SUPABASE_ANON_KEY:   process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
      RESEND_API_KEY:                  process.env.RESEND_API_KEY,
      PAYSTACK_SECRET_KEY:             process.env.PAYSTACK_SECRET_KEY,
      NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY,
      SUPABASE_SERVICE_ROLE_KEY:       process.env.SUPABASE_SERVICE_ROLE_KEY,
      EMAIL_WEBHOOK_SECRET:            process.env.EMAIL_WEBHOOK_SECRET,
      NEXT_PUBLIC_ROOT_DOMAIN:         process.env.NEXT_PUBLIC_ROOT_DOMAIN,
      NEXT_PUBLIC_APP_URL:             process.env.NEXT_PUBLIC_APP_URL,
      PORTAL_JWT_SECRET:               process.env.PORTAL_JWT_SECRET,
      NEXT_PUBLIC_BUILD_ID:            process.env.NEXT_PUBLIC_BUILD_ID,
      VERCEL_GIT_COMMIT_SHA:           process.env.VERCEL_GIT_COMMIT_SHA,
      CRON_SECRET:                     process.env.CRON_SECRET,
      NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
      NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET: process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET,
      CLOUDINARY_API_KEY:              process.env.CLOUDINARY_API_KEY,
      CLOUDINARY_API_SECRET:           process.env.CLOUDINARY_API_SECRET,
      ADMIN_EMAILS:                    process.env.ADMIN_EMAILS,
    }

/**
 * Parsed list of admin emails (lowercased). Empty when ADMIN_EMAILS is unset.
 * Used to gate the personal admin board and pick feedback-notification recipients.
 */
export const ADMIN_EMAIL_LIST: string[] = (env.ADMIN_EMAILS ?? '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean)

/** True when the given email is in the admin allowlist. */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  return ADMIN_EMAIL_LIST.includes(email.toLowerCase())
}
