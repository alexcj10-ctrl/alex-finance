import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { ApiError } from './http';

type ServerConfig = {
  supabasePublishableKey: string;
  supabaseSecretKey: string;
  supabaseUrl: string;
};

let cachedAdminClient: SupabaseClient | undefined;
let cachedConfig: ServerConfig | undefined;

export function getServerConfig(): ServerConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY?.trim();
  const supabasePublishableKey =
    process.env.SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!supabaseUrl || !supabaseSecretKey || !supabasePublishableKey) {
    throw new ApiError(
      503,
      'SERVER_NOT_CONFIGURED',
      'Servizio temporaneamente non configurato.',
    );
  }

  try {
    new URL(supabaseUrl);
  } catch {
    throw new ApiError(
      503,
      'SERVER_NOT_CONFIGURED',
      'Servizio temporaneamente non configurato.',
    );
  }

  cachedConfig = {
    supabasePublishableKey,
    supabaseSecretKey,
    supabaseUrl,
  };
  return cachedConfig;
}

export function getSupabaseAdmin() {
  if (cachedAdminClient) {
    return cachedAdminClient;
  }

  const { supabaseSecretKey, supabaseUrl } = getServerConfig();
  cachedAdminClient = createClient(supabaseUrl, supabaseSecretKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });

  return cachedAdminClient;
}

export function createSupabasePasswordClient() {
  const { supabasePublishableKey, supabaseUrl } = getServerConfig();

  return createClient(supabaseUrl, supabasePublishableKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}
