import Link from 'next/link';
import { getTipConfig } from '@/lib/data';
import { HomeFeaturedGallery } from '@/components/home-featured-gallery';
import { TipCta } from '@/components/tip-cta';

export default async function HomePage(): Promise<React.ReactElement> {
  const tip = await getTipConfig();

  return (
    <>
      <section className="hero container">
        <h1>Candid travel portraits, delivered privately.</h1>
        <p>
          Scan the private QR code I show you—no email, phone number, account, or app required. Your photos arrive in
          a link made only for your group.
        </p>
        <div className="actions">
          <Link href="/portfolio" className="button primary">
            View Portfolio
          </Link>
          <Link href="/about" className="button">
            How Delivery Works
          </Link>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <h2>Favorite Frames</h2>
          <p className="small">A hand-picked selection from my favorite travel captures.</p>
          <HomeFeaturedGallery />
        </div>
      </section>

      <TipCta username={tip.username} />
    </>
  );
}
