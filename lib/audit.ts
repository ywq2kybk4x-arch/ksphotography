import { createAdminClient } from '@/lib/supabase';

type AuditInput = {
  actorType: 'admin' | 'guest' | 'system';
  actorId?: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
};

export async function writeAuditLog(input: AuditInput): Promise<void> {
  const supabase = createAdminClient();
  await supabase.from('audit_logs').insert({
    actor_type: input.actorType,
    actor_id: input.actorId ?? null,
    action: input.action,
    target_type: input.targetType,
    target_id: input.targetId ?? null,
    metadata: input.metadata ?? {}
  });
}

