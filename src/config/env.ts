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
  NEXT_PUBLIC_ROOT_DOMAIN:            z.string().min(1).optional(),
  NEXT_PUBLIC_APP_URL:                z.string().url().optional(),
})

const parsed = envSchema.safeParse({
  NEXT_PUBLIC_SUPABASE_URL:           process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY:      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  RESEND_API_KEY:                     process.env.RESEND_API_KEY,
  PAYSTACK_SECRET_KEY:                process.env.PAYSTACK_SECRET_KEY,
  NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY:    process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY,
  SUPABASE_SERVICE_ROLE_KEY:          process.env.SUPABASE_SERVICE_ROLE_KEY,
  NEXT_PUBLIC_ROOT_DOMAIN:            process.env.NEXT_PUBLIC_ROOT_DOMAIN,
  NEXT_PUBLIC_APP_URL:                process.env.NEXT_PUBLIC_APP_URL,
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
      NEXT_PUBLIC_ROOT_DOMAIN:         process.env.NEXT_PUBLIC_ROOT_DOMAIN,
      NEXT_PUBLIC_APP_URL:             process.env.NEXT_PUBLIC_APP_URL,
    }
