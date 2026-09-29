import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database.types';

const rawSupabaseUrl = import.meta.env.VITE_SUPABASE_URL || (import.meta.env as any).SUPABASE_URL;
const rawSupabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || (import.meta.env as any).SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(
  rawSupabaseUrl &&
  rawSupabaseAnonKey &&
  rawSupabaseUrl.startsWith('http') &&
  !rawSupabaseUrl.includes('your-project-ref')
);

if (!isSupabaseConfigured) {
  console.warn(
    '[Wala Ride] Supabase URL or Anon Key is missing or invalid. Please check your environment variables (.env.local or Vercel project settings).'
  );
}

// Fallback to placeholder to prevent createClient from throwing 'supabaseUrl is required' and blanking the screen
const supabaseUrl = isSupabaseConfigured ? rawSupabaseUrl : 'https://placeholder.supabase.co';
const supabaseAnonKey = isSupabaseConfigured ? rawSupabaseAnonKey : 'placeholder-anon-key';

export const supabase = createClient<Database>(
  supabaseUrl,
  supabaseAnonKey
);

