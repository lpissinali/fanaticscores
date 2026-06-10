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
  icons: {
    // favicon-96.png exists for Google Search results: Google wants a raster
    // icon ≥48px on a SOLID background. The old text-based transparent SVG
    // rendered as an invisible white "F" in the SERP. Browsers that support
    // SVG favicons still pick it up from the second entry.
    icon: [
      { url: '/favicon-96.png', sizes: '96x96', type: 'image/png' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    shortcut: '/favicon-96.png',
    apple: '/favicon-96.png',
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
        {/* Structured data — WebSite */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: 'FanaticScores',
            url: 'https://www.fanaticscores.com',
            description: 'Real-time football scores, live match data and AI-powered match cards.',
            potentialAction: {
              '@type': 'SearchAction',
              target: { '@type': 'EntryPoint', urlTemplate: 'https://www.fanaticscores.com/en/today?q={search_term_string}' },
              'query-input': 'required name=search_term_string',
            },
          })}}
        />
        {/* Google Analytics 4 — Consent Mode v2 */}
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-Z84TC8K72Q" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('consent', 'default', { analytics_storage: 'denied', ad_storage: 'denied', wait_for_update: 500 });
              gtag('js', new Date());
              gtag('config', 'G-Z84TC8K72Q', { send_page_view: false });
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
