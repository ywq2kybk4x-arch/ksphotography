'use client';

import { useEffect, useRef, useState } from 'react';

type HomePhoto = {
  src: string;
  alt: string;
};

export function HomeFeaturedCarousel({ photos }: { photos: HomePhoto[] }): React.ReactElement {
  const touchStartXRef = useRef<number | null>(null);
  const wheelLockRef = useRef(false);
  const pauseRef = useRef(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const maxIndex = Math.max(photos.length - 1, 0);

  function clampToIndex(index: number): number {
    return Math.max(0, Math.min(index, maxIndex));
  }

  function goTo(index: number): void {
    setActiveIndex(clampToIndex(index));
  }

  function goNext(): void {
    setActiveIndex((current) => (current >= maxIndex ? 0 : current + 1));
  }

  function goPrevious(): void {
    setActiveIndex((current) => (current <= 0 ? maxIndex : current - 1));
  }

  useEffect(() => {
    if (photos.length < 2) {
      return;
    }

    const id = window.setInterval(() => {
      if (pauseRef.current) {
        return;
      }
      goNext();
    }, 5000);

    return () => window.clearInterval(id);
  }, [maxIndex, photos.length]);

  function wrappedDistance(index: number): number {
    if (!photos.length) {
      return 0;
    }

    let delta = index - activeIndex;
    const half = photos.length / 2;
    if (delta > half) {
      delta -= photos.length;
    }
    if (delta < -half) {
      delta += photos.length;
    }
    return delta;
  }

  function slideClass(index: number): string {
    const distance = wrappedDistance(index);
    if (distance === 0) {
      return 'featured-slide is-active';
    }
    if (distance === -1) {
      return 'featured-slide is-left';
    }
    if (distance === 1) {
      return 'featured-slide is-right';
    }
    return 'featured-slide is-hidden';
  }

  function handleWheel(event: React.WheelEvent<HTMLDivElement>): void {
    if (Math.abs(event.deltaX) < 10 && Math.abs(event.deltaY) < 10) {
      return;
    }
    if (wheelLockRef.current) {
      return;
    }

    wheelLockRef.current = true;
    window.setTimeout(() => {
      wheelLockRef.current = false;
    }, 340);

    if (event.deltaX > 0 || event.deltaY > 0) {
      goNext();
      return;
    }

    goPrevious();
  }

  function handleTouchStart(event: React.TouchEvent<HTMLDivElement>): void {
    touchStartXRef.current = event.changedTouches[0]?.clientX ?? null;
  }

  function handleTouchEnd(event: React.TouchEvent<HTMLDivElement>): void {
    const startX = touchStartXRef.current;
    const endX = event.changedTouches[0]?.clientX ?? null;
    touchStartXRef.current = null;
    if (startX === null || endX === null) {
      return;
    }

    const delta = endX - startX;
    if (Math.abs(delta) < 28) {
      return;
    }

    if (delta < 0) {
      goNext();
      return;
    }

    goPrevious();
  }

  return (
    <div
      className="featured-carousel"
      onMouseEnter={() => {
        pauseRef.current = true;
      }}
      onMouseLeave={() => {
        pauseRef.current = false;
      }}
      onFocusCapture={() => {
        pauseRef.current = true;
      }}
      onBlurCapture={() => {
        pauseRef.current = false;
      }}
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onKeyDown={(event) => {
        if (event.key === 'ArrowRight') {
          goNext();
        }
        if (event.key === 'ArrowLeft') {
          goPrevious();
        }
      }}
      tabIndex={0}
    >
      <div className="featured-head">
        <p className="featured-counter">
          {activeIndex + 1} / {photos.length}
        </p>
        <div className="featured-controls">
          <button className="button" type="button" onClick={goPrevious} aria-label="Previous photo">
            Previous
          </button>
          <button className="button" type="button" onClick={goNext} aria-label="Next photo">
            Next
          </button>
        </div>
      </div>

      <div className="featured-track" aria-label="Featured photos carousel">
        {photos.map((photo, index) => (
          <figure className={slideClass(index)} key={photo.src}>
            <div className="featured-media">
              <img
                src={photo.src}
                alt={photo.alt}
                className="featured-img"
                loading={index === 0 ? 'eager' : 'lazy'}
                decoding="async"
              />
            </div>
          </figure>
        ))}
      </div>

      <div className="featured-controls">
        <div className="featured-dots" aria-label="Carousel pagination">
          {photos.map((photo, index) => (
            <button
              key={photo.src}
              className={`dot ${index === activeIndex ? 'active' : ''}`}
              type="button"
              onClick={() => goTo(index)}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
