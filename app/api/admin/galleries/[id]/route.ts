import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { isAdminRequest } from '@/lib/admin';
import { createAccessToken, DELIVERY_DAYS, hashAccessToken } from '@/lib/delivery';
import { getSiteUrl } from '@/lib/env';
import { jsonError } from '@/lib/http';
import { createAdminClient } from '@/lib/supabase';
import { writeAuditLog } from '@/lib/audit';

type Params = { params: Promise<{ id: string }> };
const patchSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('publish') }),
  z.object({ action: z.literal('regenerate') }),
  z.object({ action: z.literal('update'), adminNote: z.string().max(240).nullable().optional() })
]);

export async function GET(request: NextRequest, { params }: Params): Promise<NextResponse> {
  if (!isAdminRequest(request)) return jsonError('Unauthorized', 401);
  const { id } = await params;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('delivery_galleries')
    .select('id, event_id, short_code, status, admin_note, first_opened_at, published_at, expires_at, created_at, gallery_photo_assignments(sort_order, assigned_at, photo_assets(id, title, original_filename, storage_path, preview_path, captured_at, created_at))')
    .eq('id', id)
    .single();
  if (error || !data) return jsonError('Gallery not found', 404);
  return NextResponse.json({ gallery: data });
}

export async function PATCH(request: NextRequest, { params }: Params): Promise<NextResponse> {
  if (!isAdminRequest(request)) return jsonError('Unauthorized', 401);
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError('Invalid gallery action', 422);
  const { id } = await params;
  const supabase = createAdminClient();

  if (parsed.data.action === 'publish') {
    const publishedAt = new Date();
    const expiresAt = new Date(publishedAt.getTime() + DELIVERY_DAYS * 86400000);
    const { data, error } = await supabase
      .from('delivery_galleries')
      .update({ status: 'published', published_at: publishedAt.toISOString(), expires_at: expiresAt.toISOString() })
      .eq('id', id)
      .eq('status', 'draft')
      .select('id, status, published_at, expires_at')
      .single();
    if (error || !data) return jsonError('Only a draft gallery can be published', 409);
    await writeAuditLog({ actorType: 'admin', action: 'delivery_gallery_published', targetType: 'delivery_gallery', targetId: id });
    return NextResponse.json({ gallery: data });
  }

  if (parsed.data.action === 'regenerate') {
    const token = createAccessToken();
    const { data, error } = await supabase
      .from('delivery_galleries')
      .update({ access_token_hash: hashAccessToken(token) })
      .eq('id', id)
      .select('id, short_code')
      .single();
    if (error || !data) return jsonError('Gallery not found', 404);
    const url = `${getSiteUrl().replace(/\/$/, '')}/g/${token}`;
    await writeAuditLog({ actorType: 'admin', action: 'delivery_link_regenerated', targetType: 'delivery_gallery', targetId: id });
    return NextResponse.json({ gallery: data, token, url });
  }

  const { data, error } = await supabase
    .from('delivery_galleries')
    .update({ admin_note: parsed.data.adminNote ?? null })
    .eq('id', id)
    .select('id, admin_note')
    .single();
  if (error || !data) return jsonError('Gallery not found', 404);
  return NextResponse.json({ gallery: data });
}

export async function DELETE(request: NextRequest, { params }: Params): Promise<NextResponse> {
  if (!isAdminRequest(request)) return jsonError('Unauthorized', 401);
  const { id } = await params;
  const supabase = createAdminClient();
  const { error } = await supabase.from('delivery_galleries').delete().eq('id', id).eq('status', 'draft');
  if (error) return jsonError(`Unable to delete draft: ${error.message}`, 500);
  await writeAuditLog({ actorType: 'admin', action: 'delivery_gallery_deleted', targetType: 'delivery_gallery', targetId: id });
  return NextResponse.json({ ok: true });
}
