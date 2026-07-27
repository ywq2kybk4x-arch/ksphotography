import Link from 'next/link';

export default function ClaimPage(): React.ReactElement {
  return (
    <section className="section">
      <div className="container" style={{ maxWidth: 560 }}>
        <div className="card stack">
          <span className="eyebrow">Private delivery</span>
          <h1>Scan the QR code shown by your photographer.</h1>
          <p>
            Every group receives a unique private gallery link. You do not need to provide an email address,
            phone number, password, or verification code.
          </p>
          <Link className="button" href="/portfolio">View the portfolio</Link>
        </div>
      </div>
    </section>
  );
}
