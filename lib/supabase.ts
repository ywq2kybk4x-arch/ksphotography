import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getEnv } from '@/lib/env';
import { signJwt } from '@/lib/security';

function getBaseUrl(): string {
  return getEnv('NEXT_PUBLIC_SUPABASE_URL');
}

export function createAdminClient(): SupabaseClient {
  return createClient(getBaseUrl(), getEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false }
  });
}

function createGuestRlsToken(guestId: string): string {
  const now = Math.floor(Date.now() / 1000);
  return signJwt(
    {
      aud: 'authenticated',
      role: 'authenticated',
      sub: guestId,
      guest_id: guestId,
      iat: now,
      exp: now + 60 * 5
    },
    getEnv('SUPABASE_JWT_SECRET')
  );
}

export function createGuestClient(guestId: string): SupabaseClient {
  return createClient(getBaseUrl(), getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: {
        Authorization: `Bearer ${createGuestRlsToken(guestId)}`
      }
    }
  });
}

