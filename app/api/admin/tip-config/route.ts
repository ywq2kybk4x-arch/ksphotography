import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase';
import { isAdminRequest } from '@/lib/admin';
import { jsonError } from '@/lib/http';
import { getVenmoLink } from '@/lib/venmo';
import { writeAuditLog } from '@/lib/audit';

const schema = z.object({
  venmoUsername: z.string().min(1).max(64),
  venmoQrImagePath: z.string().max(255).nullable().optional()
});

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!isAdminRequest(request)) {
    return jsonError('Unauthorized', 401);
  }

  const supabase = createAdminClient();
  const { data } = await supabase
    .from('tip_config')
    .select('venmo_username, venmo_deeplink, venmo_qr_image_path')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({
    venmoUsername: data?.venmo_username ?? process.env.VENMO_USERNAME ?? 'ksphotography',
    venmoDeeplink: data?.venmo_deeplink ?? getVenmoLink(process.env.VENMO_USERNAME),
    venmoQrImagePath: data?.venmo_qr_image_path ?? null
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isAdminRequest(request)) {
    return jsonError('Unauthorized', 401);
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return jsonError('Invalid tip config payload', 422);
  }

  const { venmoUsername, venmoQrImagePath } = parsed.data;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('tip_config')
    .insert({
      venmo_username: venmoUsername,
      venmo_deeplink: getVenmoLink(venmoUsername),
      venmo_qr_image_path: venmoQrImagePath ?? null
    })
    .select('venmo_username, venmo_deeplink, venmo_qr_image_path')
    .single();

  if (error || !data) {
    return jsonError(`Unable to save tip config: ${error?.message ?? 'unknown'}`, 500);
  }

  await writeAuditLog({
    actorType: 'admin',
    action: 'tip_config_updated',
    targetType: 'tip_config'
  });

  return NextResponse.json({
    venmoUsername: data.venmo_username,
    venmoDeeplink: data.venmo_deeplink,
    venmoQrImagePath: data.venmo_qr_image_path
  });
}

