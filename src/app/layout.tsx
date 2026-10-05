import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { GlobalAnnouncementBanner } from '@/components/layout/GlobalAnnouncementBanner';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
  display: 'swap',
  preload: true,
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  display: 'swap',
  preload: true,
});

export const viewport: Viewport = {
  themeColor: '#07090E',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  title: 'AuraDrop — Private, Temporary & Self-Destructing File Sharing',
  description:
    'Share private files and live chat that automatically delete themselves forever. No accounts, no history, zero trace.',
  icons: {
    icon: [
      { url: '/logo.png', type: 'image/png' },
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icon.png', type: 'image/png', sizes: '192x192' },
    ],
    apple: [
      { url: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
      { url: '/logo.png', type: 'image/png' },
    ],
    shortcut: ['/logo.png'],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}>
      <head>
        <link rel="icon" href="/logo.png" type="image/png" />
        <link rel="apple-touch-icon" href="/apple-icon.png" />
      </head>
      <body className="min-h-full flex flex-col bg-[#07090E] text-slate-100 selection:bg-indigo-500/30 selection:text-indigo-200 overflow-x-hidden">
        <AuthProvider>
          <GlobalAnnouncementBanner />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
