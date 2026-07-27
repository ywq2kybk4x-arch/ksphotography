import fs from 'fs/promises';
import path from 'path';
import { HomeFeaturedCarousel } from '@/components/home-featured-carousel';

type HomePhoto = {
  src: string;
  alt: string;
};

function displayNameFromFile(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
}

export async function HomeFeaturedGallery(): Promise<React.ReactElement> {
  const dir = path.join(process.cwd(), 'public', 'featured');
  const files = await fs.readdir(dir).catch(() => []);
  const imageFiles = files
    .filter((file) => /\.(jpe?g|png|webp)$/i.test(file))
    .sort((a, b) => a.localeCompare(b))
    .slice(0, 12);

  const photos: HomePhoto[] = imageFiles.map((file) => ({
    src: `/featured/${encodeURIComponent(file)}`,
    alt: displayNameFromFile(file)
  }));

  if (!photos.length) {
    return <p className="small">No featured photos found in `public/featured` yet.</p>;
  }

  return <HomeFeaturedCarousel photos={photos} />;
}
