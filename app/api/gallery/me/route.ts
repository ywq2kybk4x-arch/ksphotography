import { NextResponse } from 'next/server';
import { getGuestSessionFromCookie } from '@/lib/session';
import { createGuestClient } from '@/lib/supabase';
import { jsonError } from '@/lib/http';

export async function GET(): Promise<NextResponse> {
  const session = await getGuestSessionFromCookie();
  if (!session) {
    return jsonError('Not authenticated', 401);
  }

  const guestClient = createGuestClient(session.guestId);
  const { data, error } = await guestClient
    .from('photo_assignments')
    .select('photo_id, assigned_at, photo_assets!inner(id, title, captured_at, storage_path, visibility, deleted_at)')
    .eq('guest_id', session.guestId)
    .is('photo_assets.deleted_at', null)
    .order('assigned_at', { ascending: false });

  if (error) {
    return jsonError(`Unable to load gallery: ${error.message}`, 500);
  }

  const photos = (data ?? []).map((item) => {
    const photo = Array.isArray(item.photo_assets) ? item.photo_assets[0] : item.photo_assets;
    return {
      id: photo.id as string,
      title: (photo.title as string | null) ?? null,
      capturedAt: (photo.captured_at as string | null) ?? null,
      assignedAt: item.assigned_at as string
    };
  });

  return NextResponse.json({ photos, expiresInDays: Number(process.env.RETENTION_DAYS ?? 90) });
}

