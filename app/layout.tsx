import './globals.css';
import Link from 'next/link';

export const metadata = {
  title: 'KS Photography',
  description: 'Private photo delivery and portfolio showcase.'
};

export default function RootLayout({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <div className="container nav-wrap">
            <Link href="/" className="brand">
              KS Photography
            </Link>
            <nav className="nav-links">
              <Link href="/portfolio">Portfolio</Link>
              <Link href="/about">About</Link>
              <Link href="/claim">Get Your Photos</Link>
              <Link href="/admin">Admin</Link>
            </nav>
          </div>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}

