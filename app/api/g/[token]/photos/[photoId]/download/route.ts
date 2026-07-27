import { NextResponse } from 'next/server';
import { resolveGalleryToken } from '@/lib/gallery-access';
import { createAdminClient } from '@/lib/supabase';
import { jsonError } from '@/lib/http';
import { getDownloadTtlSeconds } from '@/lib/env';

type Params = { params: Promise<{ token: string; photoId: string }> };
export async function GET(_request: Request, { params }: Params): Promise<NextResponse> {
  const { token, photoId } = await params;
  const gallery = await resolveGalleryToken(token);
  if (!gallery || gallery.status !== 'published') return jsonError('Photo not found', 404);
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('gallery_photo_assignments')
    .select('photo_assets!inner(storage_path, original_filename, deleted_at)')
    .eq('gallery_id', gallery.id)
    .eq('photo_id', photoId)
    .is('photo_assets.deleted_at', null)
    .single();
  if (!data) return jsonError('Photo not found', 404);
  const asset = Array.isArray(data.photo_assets) ? data.photo_assets[0] : data.photo_assets;
  const { data: signed } = await supabase.storage
    .from('private-originals')
    .createSignedUrl(asset.storage_path, getDownloadTtlSeconds(), { download: asset.original_filename || 'photo.jpg' });
  if (!signed) return jsonError('Download unavailable', 404);
  return NextResponse.redirect(signed.signedUrl, 302);
}
