import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'Ритм — твой дневник движения',
  description: 'Локальный дневник тренировок с картой нагрузки, графиками и подсказками по твоим записям.',
  icons: { icon: '/favicon.svg', apple: '/icon-192.png' },
  manifest: '/manifest.webmanifest',
};
export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) {return <html lang="ru"><body>{children}</body></html>;}
