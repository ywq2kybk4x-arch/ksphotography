import { NextRequest, NextResponse } from 'next/server';
import { getGuestSessionFromCookie } from '@/lib/session';
import { createGuestClient, createAdminClient } from '@/lib/supabase';
import { getDownloadTtlSeconds } from '@/lib/env';
import { jsonError } from '@/lib/http';

type Params = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, { params }: Params): Promise<NextResponse> {
  const session = await getGuestSessionFromCookie();
  if (!session) {
    return jsonError('Not authenticated', 401);
  }

  const { id } = await params;
  const guestClient = createGuestClient(session.guestId);
  const { data: assignment, error } = await guestClient
    .from('photo_assignments')
    .select('photo_id, photo_assets!inner(id, storage_path, visibility, deleted_at)')
    .eq('guest_id', session.guestId)
    .eq('photo_id', id)
    .is('photo_assets.deleted_at', null)
    .single();

  if (error || !assignment) {
    return jsonError('Photo not found', 404);
  }

  const asset = Array.isArray(assignment.photo_assets) ? assignment.photo_assets[0] : assignment.photo_assets;
  const bucket = asset.visibility === 'public' ? 'public-portfolio' : 'private-originals';
  const supabase = createAdminClient();
  const { data: signed, error: signedError } = await supabase.storage
    .from(bucket)
    .createSignedUrl(asset.storage_path as string, getDownloadTtlSeconds(), {
      download: true
    });

  if (signedError || !signed) {
    return jsonError(`Unable to generate download URL: ${signedError?.message ?? 'unknown'}`, 500);
  }

  const url = new URL(signed.signedUrl);
  url.searchParams.set('download', '1');
  return NextResponse.redirect(url.toString(), 302);
}

