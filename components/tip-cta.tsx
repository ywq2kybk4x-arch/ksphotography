import Link from 'next/link';
import { getVenmoLink } from '@/lib/venmo';

export function TipCta({ username }: { username?: string }): React.ReactElement {
  return (
    <section className="section">
      <div className="container card">
        <h3>Enjoyed the photo?</h3>
        <p className="small">
          Tips are optional and always appreciated. They help me keep offering candid vacation portraits.
        </p>
        <div className="actions">
          <Link href={getVenmoLink(username)} className="button accent" target="_blank">
            Tip on Venmo
          </Link>
        </div>
      </div>
    </section>
  );
}

