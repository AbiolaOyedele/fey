import type { NextConfig } from 'next'

// Commit SHA of this build (Vercel sets VERCEL_GIT_COMMIT_SHA). Inlined into the
// client bundle so the running app can detect when a newer deploy is live.
const BUILD_ID = process.env.VERCEL_GIT_COMMIT_SHA || 'dev'

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_BUILD_ID: BUILD_ID,
  },
  devIndicators: false,
}

export default nextConfig
