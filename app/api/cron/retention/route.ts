import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { getRetentionDays } from '@/lib/env';
import { jsonError } from '@/lib/http';
import { writeAuditLog } from '@/lib/audit';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = request.headers.get('authorization');
  const expected = process.env.CRON_SECRET;
  if (!expected || auth !== `Bearer ${expected}`) {
    return jsonError('Unauthorized', 401);
  }

  const cutoff = new Date(Date.now() - getRetentionDays() * 24 * 60 * 60 * 1000).toISOString();
  const supabase = createAdminClient();

  const { data: expiredAssets, error: findError } = await supabase
    .from('photo_assets')
    .select('id, storage_path')
    .eq('visibility', 'private')
    .is('deleted_at', null)
    .lt('created_at', cutoff);

  if (findError) {
    return jsonError(`Unable to query retention assets: ${findError.message}`, 500);
  }

  const ids = (expiredAssets ?? []).map((row) => row.id);
  if (ids.length === 0) {
    return NextResponse.json({ deleted: 0 });
  }

  const paths = (expiredAssets ?? []).map((row) => row.storage_path);
  await supabase.storage.from('private-originals').remove(paths);
  await supabase.from('photo_assignments').delete().in('photo_id', ids);
  await supabase.from('photo_assets').update({ deleted_at: new Date().toISOString() }).in('id', ids);

  await writeAuditLog({
    actorType: 'system',
    action: 'retention_cleanup',
    targetType: 'photo_asset',
    metadata: { deletedCount: ids.length }
  });

  return NextResponse.json({ deleted: ids.length });
}

