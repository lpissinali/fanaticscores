import type { Metadata } from 'next';
import TermsPageClient from '@/src/views/legal/TermsPage';

export const metadata: Metadata = {
  title: 'Terms & Conditions',
  alternates: { canonical: '/en/terms' },
  robots: { index: false },
};

export default function TermsPage() {
  return <TermsPageClient locale="en" />;
}
