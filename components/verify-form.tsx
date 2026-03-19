'use client';

import { useMemo, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

export function VerifyForm(): React.ReactElement {
  const params = useSearchParams();
  const router = useRouter();
  const guestId = params.get('guestId') ?? '';
  const contact = params.get('contact') ?? '';
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValid = useMemo(() => guestId.length > 0, [guestId]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guestId, code })
      });
      const payload = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(payload.error ?? 'Verification failed');
      }
      router.push('/gallery');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error');
    } finally {
      setLoading(false);
    }
  }

  if (!isValid) {
    return <div className="error">Missing verification session. Start again from the claim page.</div>;
  }

  return (
    <form onSubmit={onSubmit} className="card">
      <div className="stack">
        <h2>Verify access</h2>
        <p className="small">Enter the one-time code sent to {contact || 'your contact'}.</p>
        <label>
          One-time code
          <input required value={code} onChange={(e) => setCode(e.target.value)} />
        </label>
        {error && <div className="error">{error}</div>}
        <button className="button primary" disabled={loading} type="submit">
          {loading ? 'Verifying...' : 'Open my gallery'}
        </button>
      </div>
    </form>
  );
}
