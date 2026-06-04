import type { Metadata } from 'next';
import PrivacyPageClient from '@/src/views/legal/PrivacyPage';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  alternates: { canonical: '/en/privacy' },
  robots: { index: false },
};

export default function PrivacyPage() {
  return <PrivacyPageClient locale="en" />;
}
