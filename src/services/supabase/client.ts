import { createClient } from '@supabase/supabase-js';
import { config } from '../../config/env';

// Service role client — full DB access, only used server-side
// NEVER expose this key to the Flutter client
export const supabase = createClient(
  config.supabase.url,
  config.supabase.serviceRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);
