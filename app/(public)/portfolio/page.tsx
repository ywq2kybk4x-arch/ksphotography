import { getPublicPhotos, getTipConfig } from '@/lib/data';
import { PublicPhotoGrid } from '@/components/public-photo-grid';
import { TipCta } from '@/components/tip-cta';

export default async function PortfolioPage(): Promise<React.ReactElement> {
  const [photos, tip] = await Promise.all([getPublicPhotos(30), getTipConfig()]);

  return (
    <>
      <section className="section">
        <div className="container">
          <h1>Portfolio</h1>
          <p className="small">A curated public set, fully separated from private client delivery galleries.</p>
          <PublicPhotoGrid photos={photos} />
        </div>
      </section>
      <TipCta username={tip.username} />
    </>
  );
}

