import { redirect } from 'next/navigation';
import { AdminLoginForm } from '@/components/admin-login-form';
import { hasAdminSessionCookie } from '@/lib/admin-session';

export default async function AdminLoginPage(): Promise<React.ReactElement> {
  const alreadyLoggedIn = await hasAdminSessionCookie();
  if (alreadyLoggedIn) {
    redirect('/admin');
  }

  return (
    <section className="section">
      <div className="container">
        <AdminLoginForm />
      </div>
    </section>
  );
}

