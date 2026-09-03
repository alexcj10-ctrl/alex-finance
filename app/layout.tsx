import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://esordienti-analyst.alexcj10.chatgpt.site'),
  title: 'ESORDIENTI ANALYST | Lavagna tattica calcio a 9',
  description:
    'Strumento operativo in italiano per leggere, allenare e condividere i principi del calcio a 9 nella categoria Esordienti.',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'it_IT',
    url: 'https://esordienti-analyst.alexcj10.chatgpt.site',
    siteName: 'ESORDIENTI ANALYST',
    title: 'ESORDIENTI ANALYST | Calcio a 9',
    description: 'Leggi il gioco. Allena la scelta.',
    images: [
      {
        url: 'https://esordienti-analyst.alexcj10.chatgpt.site/og.png',
        width: 1200,
        height: 630,
        alt: 'ESORDIENTI ANALYST — Leggi il gioco. Allena la scelta.',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ESORDIENTI ANALYST | Calcio a 9',
    description: 'Leggi il gioco. Allena la scelta.',
    images: ['https://esordienti-analyst.alexcj10.chatgpt.site/og.png'],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#071b13',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
