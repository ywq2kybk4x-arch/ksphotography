import { createAdminClient } from '@/lib/supabase';
import { PublicPhoto } from '@/lib/types';

function hasSupabaseEnv(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export async function getPublicPhotos(limit = 12): Promise<PublicPhoto[]> {
  if (!hasSupabaseEnv()) {
    return [];
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('photo_assets')
    .select('id, title, storage_path, captured_at')
    .eq('visibility', 'public')
    .is('deleted_at', null)
    .order('captured_at', { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error || !data) {
    return [];
  }
  return data;
}

export async function getTipConfig(): Promise<{ username: string; deeplink: string | null; qrImagePath: string | null }> {
  if (!hasSupabaseEnv()) {
    return {
      username: process.env.VENMO_USERNAME ?? 'ksphotography',
      deeplink: null,
      qrImagePath: null
    };
  }

  const supabase = createAdminClient();
  const { data } = await supabase
    .from('tip_config')
    .select('venmo_username, venmo_deeplink, venmo_qr_image_path')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    username: data?.venmo_username ?? process.env.VENMO_USERNAME ?? 'ksphotography',
    deeplink: data?.venmo_deeplink ?? null,
    qrImagePath: data?.venmo_qr_image_path ?? null
  };
}
