import { ClaimForm } from '@/components/claim-form';

export default function ClaimPage(): React.ReactElement {
  return (
    <section className="section">
      <div className="container" style={{ maxWidth: 560 }}>
        <ClaimForm />
      </div>
    </section>
  );
}

