import type { Metadata } from 'next';
import CookiesPageClient from '@/src/pages/legal/CookiesPage';

export const metadata: Metadata = {
  title: 'Cookie Policy',
  alternates: { canonical: '/en/cookies' },
  robots: { index: false },
};

export default function CookiesPage() {
  return <CookiesPageClient locale="en" />;
}
