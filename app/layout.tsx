import type { Metadata } from 'next';
import { Archivo, JetBrains_Mono, Saira } from 'next/font/google';
import './globals.css';

const archivo = Archivo({
  subsets: ['latin'],
  axes: ['wdth'],
  style: ['normal', 'italic'],
  variable: '--font-archivo',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

const saira = Saira({
  subsets: ['latin'],
  weight: ['900'],
  style: ['italic'],
  variable: '--font-saira',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://www.fanaticscores.com'),
  title: {
    default: "FanaticScores — Today's Football Scores",
    template: '%s | FanaticScores',
  },
  description: 'Real-time football scores, live match data and AI-powered match cards — all in one place.',
  openGraph: {
    siteName: 'FanaticScores',
    type: 'website',
    images: [{ url: '/og-default.png', width: 1200, height: 630 }],
  },
  twitter: { card: 'summary_large_image' },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${archivo.variable} ${jetbrainsMono.variable} ${saira.variable}`}
    >
      <head>
        {/* Google Analytics 4 