import { AdminPanel } from '@/components/admin-panel';

export default function AdminPage(): React.ReactElement {
  return (
    <section className="section">
      <div className="container">
        <h1>Admin Dashboard</h1>
        <p className="small">Manage events, uploads, assignments, retention, and Venmo settings.</p>
        <AdminPanel />
      </div>
    </section>
  );
}

