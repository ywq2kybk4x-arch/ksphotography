import crypto from 'crypto';
import { ContactType } from '@/lib/types';

function base64UrlEncode(input: Buffer | string): string {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buffer.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function base64UrlDecode(input: string): Buffer {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4;
  const withPadding = normalized + (padding ? '='.repeat(4 - padding) : '');
  return Buffer.from(withPadding, 'base64');
}

export function normalizeContact(contactType: ContactType, value: string): string {
  if (contactType !== 'email') {
    throw new Error('Only email contact type is supported');
  }
  return value.trim().toLowerCase();
}

export function hashValue(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function createNumericCode(length = 6): string {
  const min = 10 ** (length - 1);
  const max = 10 ** length - 1;
  return String(crypto.randomInt(min, max + 1));
}

export function signJwt(payload: Record<string, unknown>, secret: string): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const body = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto.createHmac('sha256', secret).update(body).digest();
  return `${body}.${base64UrlEncode(signature)}`;
}

export function verifyJwt(token: string, secret: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length !== 3) {
    return null;
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const body = `${encodedHeader}.${encodedPayload}`;
  const expectedSig = crypto.createHmac('sha256', secret).update(body).digest();
  const actualSig = base64UrlDecode(encodedSignature);

  if (actualSig.length !== expectedSig.length) {
    return null;
  }
  if (!crypto.timingSafeEqual(actualSig, expectedSig)) {
    return null;
  }

  const payload = JSON.parse(base64UrlDecode(encodedPayload).toString('utf8')) as Record<string, unknown>;
  if (typeof payload.exp === 'number' && payload.exp < Math.floor(Date.now() / 1000)) {
    return null;
  }

  return payload;
}
