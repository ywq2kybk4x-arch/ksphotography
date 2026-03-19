const REQUIRED_ENV = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_JWT_SECRET',
  'APP_SESSION_SECRET'
] as const;

export function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

export function assertCoreEnv(): void {
  for (const key of REQUIRED_ENV) {
    getEnv(key);
  }
}

export function getOtpExpiryMinutes(): number {
  return Number(process.env.OTP_EXPIRY_MINUTES ?? 10);
}

export function getOtpMaxAttempts(): number {
  return Number(process.env.OTP_MAX_ATTEMPTS ?? 5);
}

export function getRetentionDays(): number {
  return Number(process.env.RETENTION_DAYS ?? 90);
}

export function getDownloadTtlSeconds(): number {
  return Number(process.env.DOWNLOAD_URL_TTL_SECONDS ?? 90);
}

export function getSiteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
}

export function getVenmoUsername(): string {
  return process.env.VENMO_USERNAME ?? 'ksphotography';
}
