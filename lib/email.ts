type SendOtpEmailInput = {
  to: string;
  code: string;
  expiryMinutes: number;
};

type SendOtpEmailResult =
  | { ok: true }
  | { ok: false; reason: 'missing_config' | 'provider_error'; detail: string };

export async function sendOtpEmail(input: SendOtpEmailInput): Promise<SendOtpEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.OTP_FROM_EMAIL;
  const replyTo = process.env.OTP_REPLY_TO;

  if (!apiKey || !from) {
    return {
      ok: false,
      reason: 'missing_config',
      detail: 'Missing RESEND_API_KEY or OTP_FROM_EMAIL'
    };
  }

  const subject = `Your KS Photography verification code: ${input.code}`;
  const text = `Your verification code is ${input.code}. It expires in ${input.expiryMinutes} minutes.`;
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111;">
      <h2 style="margin: 0 0 12px;">KS Photography verification</h2>
      <p>Your one-time code is:</p>
      <p style="font-size: 28px; font-weight: 700; letter-spacing: 2px; margin: 8px 0 12px;">
        ${input.code}
      </p>
      <p>This code expires in ${input.expiryMinutes} minutes.</p>
    </div>
  `;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject,
      text,
      html,
      reply_to: replyTo ? [replyTo] : undefined
    })
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    return {
      ok: false,
      reason: 'provider_error',
      detail: `Resend error ${response.status}: ${body}`
    };
  }

  return { ok: true };
}

