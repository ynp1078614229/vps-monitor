import type { Metadata } from 'next';
import { Inspector } from 'react-dev-inspector';
import { FontPreload } from '@/components/font-preload';
import './globals.css';

export const metadata: Metadata = {
  title: 'VPS 监控 - 服务器状态仪表盘',
  description: '实时 VPS 监控仪表盘，展示 CPU、内存、网络流量等指标',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const isDev = process.env.COZE_PROJECT_ENV === 'DEV';

  return (
    <html lang="zh-CN">
      <body className={`antialiased bg-[var(--background)] text-[var(--foreground)]`}>
        <FontPreload />
        {isDev && <Inspector />}
        {children}
      </body>
    </html>
  );
}
