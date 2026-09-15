import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '../../types/database';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

function readAuthCallbackType() {
  if (typeof window === 'undefined') return null;
  const search = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  return hash.get('type') ?? search.get('type');
}

// Capture this before Supabase consumes the callback URL asynchronously.
export const supabaseAuthCallbackType = readAuthCallbackType();

export const supabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);

export const supabaseClient: SupabaseClient<Database> | null =
  supabaseUrl && supabasePublishableKey
    ? createClient<Database>(supabaseUrl, supabasePublishableKey, {
        auth: {
          autoRefreshToken: true,
          detectSessionInUrl: true,
          persistSession: true,
        },
      })
    : null;

export function requireSupabaseClient() {
  if (!supabaseClient) {
    throw new Error(
      'Supabase non configurato: aggiungi VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY.',
    );
  }

  return supabaseClient;
}
