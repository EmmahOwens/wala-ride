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

export function getPortalStorageKey(): string {
  if (typeof window === 'undefined') return 'wala_passenger_session';
  const dataApp = document.documentElement.getAttribute('data-app');
  if (dataApp === 'admin') return 'wala_admin_session';
  if (dataApp === 'driver') return 'wala_driver_session';
  if (dataApp === 'passenger') return 'wala_passenger_session';

  const hostname = window.location.hostname;
  const pathname = window.location.pathname;
  if (hostname.startsWith('admin.') || pathname.startsWith('/admin')) {
    return 'wala_admin_session';
  }
  if (hostname.startsWith('driver.') || pathname.startsWith('/driver')) {
    return 'wala_driver_session';
  }
  return 'wala_passenger_session';
}

export const supabase = createClient<Database>(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      storageKey: getPortalStorageKey(),
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);

