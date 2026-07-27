import { createAdminClient } from '@/lib/supabase';
import { hashAccessToken, isValidAccessToken } from '@/lib/delivery';

export async function resolveGalleryToken(token: string): Promise<{
  id: string;
  short_code: string;
  status: 'draft' | 'published' | 'expired';
  first_opened_at: string | null;
  published_at: string | null;
  expires_at: string | null;
} | null> {
  if (!isValidAccessToken(token)) return null;
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('delivery_galleries')
    .select('id, short_code, status, first_opened_at, published_at, expires_at')
    .eq('access_token_hash', hashAccessToken(token))
    .maybeSingle();
  if (!data) return null;
  if (data.status === 'published' && data.expires_at && new Date(data.expires_at).getTime() <= Date.now()) {
    await supabase.from('delivery_galleries').update({ status: 'expired' }).eq('id', data.id);
    return { ...data, status: 'expired' };
  }
  return data;
}
