import { Suspense } from 'react';
import { VerifyForm } from '@/components/verify-form';

export default function VerifyPage(): React.ReactElement {
  return (
    <section className="section">
      <div className="container" style={{ maxWidth: 560 }}>
        <Suspense fallback={<p className="small">Loading verification...</p>}>
          <VerifyForm />
        </Suspense>
      </div>
    </section>
  );
}
