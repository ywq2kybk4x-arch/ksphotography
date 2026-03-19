import { createAdminClient } from '@/lib/supabase';
import { getOtpExpiryMinutes, getOtpMaxAttempts } from '@/lib/env';
import { createNumericCode, hashValue } from '@/lib/security';

export async function createOtpCode(guestId: string): Promise<string> {
  const code = createNumericCode(6);
  const codeHash = hashValue(code);
  const expiresAt = new Date(Date.now() + getOtpExpiryMinutes() * 60 * 1000).toISOString();

  const supabase = createAdminClient();
  const { error } = await supabase.from('otp_codes').insert({
    guest_id: guestId,
    code_hash: codeHash,
    expires_at: expiresAt,
    attempts: 0
  });

  if (error) {
    throw new Error(`Failed to create OTP: ${error.message}`);
  }

  return code;
}

export async function verifyOtpCode(guestId: string, rawCode: string): Promise<boolean> {
  const supabase = createAdminClient();
  const nowIso = new Date().toISOString();

  const { data: latest, error } = await supabase
    .from('otp_codes')
    .select('id, code_hash, attempts, expires_at, consumed_at')
    .eq('guest_id', guestId)
    .is('consumed_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!latest || latest.expires_at < nowIso) {
    return false;
  }

  if (latest.attempts >= getOtpMaxAttempts()) {
    return false;
  }

  const matches = hashValue(rawCode) === latest.code_hash;
  if (!matches) {
    await supabase
      .from('otp_codes')
      .update({ attempts: latest.attempts + 1 })
      .eq('id', latest.id);
    return false;
  }

  const { error: updateError } = await supabase
    .from('otp_codes')
    .update({ consumed_at: new Date().toISOString(), attempts: latest.attempts + 1 })
    .eq('id', latest.id);
  if (updateError) {
    throw new Error(updateError.message);
  }

  return true;
}

