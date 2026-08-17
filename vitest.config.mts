import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

/**
 * Component and unit tests (TESTING.md: Vitest + React Testing Library).
 *
 * No @vitejs/plugin-react: its current major pulls Babel 8, which conflicts
 * with the Babel 7 already in this tree. Nothing here needs Babel — Vite's own
 * transform handles the automatic JSX runtime, and Fast Refresh is a dev-server
 * concern that tests don't have.
 *
 * `.mts` rather than `.ts` so the config is loaded as ESM; as `.ts` it is read
 * as CommonJS and every run prints a deprecation warning, which is how a test
 * suite starts getting ignored.
 */
export default defineConfig({
  resolve: {
    alias: { '@': resolve(__dirname, './src') },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    css: false,
    // Only the two the client bundle validates at import time. src/config/env.ts
    // throws on startup by design, and the Supabase browser client is built the
    // moment anything imports it — so a component test would die on the
    // environment before reaching the component. These are placeholders: no
    // test may talk to a real service, and none of them do.
    env: {
      NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
    },
  },
})
