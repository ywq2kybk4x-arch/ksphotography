import { TipCta } from '@/components/tip-cta';

export default function AboutPage(): React.ReactElement {
  return (
    <>
      <section className="section">
        <div className="container card">
          <h1>About KS Photography</h1>
          <p>
            I capture candid moments while traveling and share them privately with the people in each frame. My delivery
            flow is built to keep your gallery personal and easy to access.
          </p>
          <p className="small">
            Privacy: your contact details are used only for secure delivery and your private gallery has a default
            90-day retention window.
          </p>
        </div>
      </section>
      <TipCta />
    </>
  );
}

