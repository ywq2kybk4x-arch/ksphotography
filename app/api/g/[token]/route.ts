import { NextResponse } from 'next/server';
import { resolveGalleryToken } from '@/lib/gallery-access';
import { createAdminClient } from '@/lib/supabase';
import { jsonError } from '@/lib/http';

type Params = { params: Promise<{ token: string }> };

export async function GET(_request: Request, { params }: Params): Promise<NextResponse> {
  const { token } = await params;
  const gallery = await resolveGalleryToken(token);
  if (!gallery) return jsonError('Gallery not found', 404);
  const supabase = createAdminClient();

  if (!gallery.first_opened_at) {
    const opened = new Date().toISOString();
    await supabase.from('delivery_galleries').update({ first_opened_at: opened }).eq('id', gallery.id);
    gallery.first_opened_at = opened;
  }
  if (gallery.status !== 'published') {
    return NextResponse.json({
      gallery: {
        shortCode: gallery.short_code,
        status: gallery.status,
        firstOpenedAt: gallery.first_opened_at,
        expiresAt: gallery.expires_at
      },
      photos: []
    });
  }

  const { data, error } = await supabase
    .from('gallery_photo_assignments')
    .select('sort_order, photo_assets!inner(id, title, original_filename, captured_at, deleted_at)')
    .eq('gallery_id', gallery.id)
    .is('photo_assets.deleted_at', null)
    .order('sort_order', { ascending: true });
  if (error) return jsonError(`Unable to load gallery: ${error.message}`, 500);
  const photos = (data ?? []).map((row) => {
    const asset = Array.isArray(row.photo_assets) ? row.photo_assets[0] : row.photo_assets;
    return {
      id: asset.id,
      title: asset.title,
      filename: asset.original_filename,
      capturedAt: asset.captured_at,
      previewUrl: `/api/g/${token}/photos/${asset.id}/preview`,
      downloadUrl: `/api/g/${token}/photos/${asset.id}/download`
    };
  });
  return NextResponse.json({
    gallery: {
      shortCode: gallery.short_code,
      status: gallery.status,
      firstOpenedAt: gallery.first_opened_at,
      publishedAt: gallery.published_at,
      expiresAt: gallery.expires_at
    },
    photos
  });
}
