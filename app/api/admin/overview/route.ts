import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { isAdminRequest } from '@/lib/admin';
import { jsonError } from '@/lib/http';

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!isAdminRequest(request)) {
    return jsonError('Unauthorized', 401);
  }

  const supabase = createAdminClient();

  const [{ data: activeEvent, error: eventError }, { data: recentGalleries, error: galleryError }, { data: recentPhotos, error: photoError }] =
    await Promise.all([
      supabase
        .from('events')
        .select('id, title, location, is_active, created_at')
        .eq('is_active', true)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('delivery_galleries')
        .select('id, short_code, status, admin_note, first_opened_at, published_at, expires_at, created_at, event_id')
        .order('created_at', { ascending: false })
        .limit(100),
      supabase
        .from('photo_assets')
        .select('id, title, original_filename, visibility, captured_at, created_at, event_id, gallery_photo_assignments(gallery_id)')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(100)
    ]);

  if (eventError || galleryError || photoError) {
    return jsonError(
      `Unable to load admin overview: ${eventError?.message ?? galleryError?.message ?? photoError?.message ?? 'unknown'}`,
      500
    );
  }

  return NextResponse.json({
    activeEvent: activeEvent ?? null,
    galleries: recentGalleries ?? [],
    recentPhotos: recentPhotos ?? []
  });
}
