import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  'https://ajpzbntxooowpnwgkhcu.supabase.co';

const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqcHpibnR4b29vd3Bud2draGN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5MDAxNzMsImV4cCI6MjA5MTQ3NjE3M30.d7C8T_SLQ5s83dT1OTSAlseMAWZsy8PxvHDfJZW-aRM';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
});
