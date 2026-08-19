import type { Metadata } from 'next';
import { Inspector } from 'react-dev-inspector';
import { FontPreload } from '@/components/font-preload';
import './globals.css';

export const metadata: Metadata = {
  title: 'VPS Monitor - Server Status Dashboard',
  description: 'Real-time VPS monitoring dashboard for CPU, memory, and network metrics',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const isDev = process.env.COZE_PROJECT_ENV === 'DEV';

  return (
    <html lang="en" className="dark">
      <body className={`antialiased bg-[var(--background)] text-[var(--foreground)]`}>
        <FontPreload />
        {isDev && <Inspector />}
        {children}
      </body>
    </html>
  );
}
