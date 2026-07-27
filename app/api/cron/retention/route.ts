import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { jsonError } from '@/lib/http';
import { writeAuditLog } from '@/lib/audit';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = request.headers.get('authorization');
  const expected = process.env.CRON_SECRET;
  if (!expected || auth !== `Bearer ${expected}`) {
    return jsonError('Unauthorized', 401);
  }

  const now = new Date().toISOString();
  const supabase = createAdminClient();

  const { data: expiredGalleries, error: galleryError } = await supabase
    .from('delivery_galleries')
    .select('id')
    .eq('status', 'published')
    .lte('expires_at', now);
  if (galleryError) return jsonError(`Unable to query expired galleries: ${galleryError.message}`, 500);
  const galleryIds = (expiredGalleries ?? []).map((row) => row.id);
  if (!galleryIds.length) return NextResponse.json({ deleted: 0, galleriesExpired: 0 });

  const { data: assignments, error: assignmentError } = await supabase
    .from('gallery_photo_assignments')
    .select('photo_id')
    .in('gallery_id', galleryIds);
  if (assignmentError) return jsonError(`Unable to query gallery photos: ${assignmentError.message}`, 500);
  const ids = (assignments ?? []).map((row) => row.photo_id);

  const { data: expiredAssets, error: findError } = ids.length
    ? await supabase.from('photo_assets').select('id, storage_path, preview_path').in('id', ids).is('deleted_at', null)
    : { data: [], error: null };

  if (findError) {
    return jsonError(`Unable to query retention assets: ${findError.message}`, 500);
  }

  const paths = (expiredAssets ?? []).map((row) => row.storage_path);
  const previewPaths = (expiredAssets ?? []).map((row) => row.preview_path).filter(Boolean);
  if (paths.length) await supabase.storage.from('private-originals').remove(paths);
  if (previewPaths.length) await supabase.storage.from('private-previews').remove(previewPaths);
  if (ids.length) await supabase.from('photo_assets').update({ deleted_at: now }).in('id', ids);
  await supabase.from('delivery_galleries').update({ status: 'expired' }).in('id', galleryIds);

  await writeAuditLog({
    actorType: 'system',
    action: 'retention_cleanup',
    targetType: 'photo_asset',
    metadata: { deletedCount: ids.length }
  });

  return NextResponse.json({ deleted: ids.length, galleriesExpired: galleryIds.length });
}
