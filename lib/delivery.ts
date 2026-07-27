import crypto from 'crypto';

const CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

export function createAccessToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

export function hashAccessToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function createShortCode(): string {
  const bytes = crypto.randomBytes(4);
  return Array.from(bytes, (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join('');
}

export function isValidAccessToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{40,60}$/.test(token);
}

export const DELIVERY_DAYS = 3;
