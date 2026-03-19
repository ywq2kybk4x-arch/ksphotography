import { GalleryClient } from '@/components/gallery-client';
import { TipCta } from '@/components/tip-cta';

export default function GalleryPage(): React.ReactElement {
  return (
    <>
      <section className="section">
        <div className="container">
          <h1>Your Private Gallery</h1>
          <GalleryClient />
        </div>
      </section>
      <TipCta />
    </>
  );
}

