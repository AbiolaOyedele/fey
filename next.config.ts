import type { NextConfig } from 'next'

// Commit SHA of this build (Vercel sets VERCEL_GIT_COMMIT_SHA). Inlined into the
// client bundle so the running app can detect when a newer deploy is live.
const BUILD_ID = process.env.VERCEL_GIT_COMMIT_SHA || 'dev'

// Baseline security headers applied to every response. These are the free,
// framework-level protections (the WAF/BotID layer is configured on Vercel).
// No CSP yet — it needs an audit of inline scripts/styles + the Cloudinary,
// Supabase and Paystack origins; tracked in ROADMAP B6.
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
]

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_BUILD_ID: BUILD_ID,
  },
  devIndicators: false,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
}

export default nextConfig
