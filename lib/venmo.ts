import { getVenmoUsername } from '@/lib/env';

export function getVenmoLink(username?: string): string {
  const user = username ?? getVenmoUsername();
  return `https://venmo.com/${encodeURIComponent(user)}?txn=pay`;
}

