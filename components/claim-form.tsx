'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type ClaimResponse = {
  guestId: string;
  contact: string;
};

export function ClaimForm(): React.ReactElement {
  const router = useRouter();
  const [contactValue, setContactValue] = useState('');
  const [name, setName] = useState('');
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setStatus(null);

    try {
      const claimRes = await fetch('/api/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactValue,
          consentAccepted: consent,
          policyVersion: 'v1-2026-03-19',
          name
        })
      });
      const claimData = (await claimRes.json()) as ClaimResponse & { error?: string };
      if (!claimRes.ok) {
        throw new Error(claimData.error ?? 'Unable to create claim');
      }

      const otpRes = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guestId: claimData.guestId })
      });
      const otpData = (await otpRes.json()) as { error?: string };
      if (!otpRes.ok) {
        throw new Error(otpData.error ?? 'Unable to send OTP');
      }

      const params = new URLSearchParams({
        guestId: claimData.guestId,
        contact: claimData.contact
      });
      setStatus('Code sent. Redirecting to verification...');
      router.push(`/verify?${params.toString()}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="card">
      <div className="stack">
        <h2>Get your photos</h2>
        <p className="small">Scan, claim, verify. You will only see photos assigned to you.</p>

        <label>
          Email address
          <input required type="email" value={contactValue} onChange={(e) => setContactValue(e.target.value)} />
        </label>

        <label>
          First name (optional)
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>

        <label>
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} required />
          <span className="small"> I accept the privacy policy and terms for photo delivery and retention.</span>
        </label>

        {status && <div className="status">{status}</div>}
        {error && <div className="error">{error}</div>}
        <button className="button primary" disabled={loading} type="submit">
          {loading ? 'Sending...' : 'Send verification code'}
        </button>
      </div>
    </form>
  );
}
