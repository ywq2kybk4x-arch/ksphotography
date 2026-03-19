import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase';
import { isAdminRequest } from '@/lib/admin';
import { jsonError } from '@/lib/http';
import { writeAuditLog } from '@/lib/audit';

const schema = z.object({
  eventId: z.string().uuid(),
  filename: z.string().min(1),
  contentType: z.string().min(3),
  visibility: z.enum(['private', 'public']),
  capturedAt: z.string().datetime().optional(),
  checksum: z.string().max(255).optional(),
  title: z.string().max(160).optional()
});

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isAdminRequest(request)) {
    return jsonError('Unauthorized', 401);
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return jsonError('Invalid upload payload', 422);
  }

  const payload = parsed.data;
  const bucket = payload.visibility === 'public' ? 'public-portfolio' : 'private-originals';
  const path = `${payload.eventId}/${crypto.randomUUID()}-${sanitizeFileName(payload.filename)}`;
  const supabase = createAdminClient();

  const { data: asset, error: assetError } = await supabase
    .from('photo_assets')
    .insert({
      event_id: payload.eventId,
      storage_path: path,
      checksum: payload.checksum ?? null,
      captured_at: payload.capturedAt ?? null,
      visibility: payload.visibility,
      title: payload.title ?? null
    })
    .select('id')
    .single();

  if (assetError || !asset) {
    return jsonError(`Unable to create asset record: ${assetError?.message ?? 'unknown'}`, 500);
  }

  const { data: signed, error: signedError } = await supabase.storage.from(bucket).createSignedUploadUrl(path);
  if (signedError || !signed) {
    await supabase.from('photo_assets').delete().eq('id', asset.id);
    return jsonError(`Unable to create signed upload URL: ${signedError?.message ?? 'unknown'}`, 500);
  }

  await writeAuditLog({
    actorType: 'admin',
    action: 'photo_upload_initialized',
    targetType: 'photo_asset',
    targetId: asset.id,
    metadata: { eventId: payload.eventId, visibility: payload.visibility }
  });

  return NextResponse.json({
    photoId: asset.id,
    bucket,
    path,
    token: signed.token,
    signedUrl: signed.signedUrl
  });
}

