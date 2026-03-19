import { redirect } from 'next/navigation';
import { AdminPanel } from '@/components/admin-panel';
import { hasAdminSessionCookie } from '@/lib/admin-session';

export default async function AdminPage(): Promise<React.ReactElement> {
  const isAuthed = await hasAdminSessionCookie();
  if (!isAuthed) {
    redirect('/admin/login');
  }

  return (
    <section className="section">
      <div className="container">
        <AdminPanel />
      </div>
    </section>
  );
}
