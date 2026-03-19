import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { isAdminRequest } from '@/lib/admin';
import { jsonError } from '@/lib/http';

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!isAdminRequest(request)) {
    return jsonError('Unauthorized', 401);
  }

  const supabase = createAdminClient();

  const [{ data: activeEvent, error: eventError }, { data: recentGuests, error: guestError }, { data: recentPhotos, error: photoError }] =
    await Promise.all([
      supabase
        .from('events')
        .select('id, title, location, is_active, created_at')
        .eq('is_active', true)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('guests')
        .select('id, contact_value_masked, created_at, event_id')
        .order('created_at', { ascending: false })
        .limit(10),
      supabase
        .from('photo_assets')
        .select('id, visibility, created_at, event_id')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(10)
    ]);

  if (eventError || guestError || photoError) {
    return jsonError(
      `Unable to load admin overview: ${eventError?.message ?? guestError?.message ?? photoError?.message ?? 'unknown'}`,
      500
    );
  }

  return NextResponse.json({
    activeEvent: activeEvent ?? null,
    recentGuests: recentGuests ?? [],
    recentPhotos: recentPhotos ?? []
  });
}

