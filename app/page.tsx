import Link from 'next/link';
import { getPublicPhotos, getTipConfig } from '@/lib/data';
import { PublicPhotoGrid } from '@/components/public-photo-grid';
import { TipCta } from '@/components/tip-cta';

export default async function HomePage(): Promise<React.ReactElement> {
  const [photos, tip] = await Promise.all([getPublicPhotos(6), getTipConfig()]);

  return (
    <>
      <section className="hero container">
        <h1>Candid travel portraits, delivered privately.</h1>
        <p>
          Scan my QR code, verify once, and receive only the photos I assign to you. Public portfolio work is curated
          separately.
        </p>
        <div className="actions">
          <Link href="/claim" className="button primary">
            Get Your Photos
          </Link>
          <Link href="/portfolio" className="button">
            View Portfolio
          </Link>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <h2>Featured Work</h2>
          <PublicPhotoGrid photos={photos} />
        </div>
      </section>

      <TipCta username={tip.username} />
    </>
  );
}

