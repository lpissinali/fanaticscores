import type { Metadata } from 'next';
import FollowingPageClient from '@/src/views/following/FollowingPage';

export const metadata: Metadata = {
  title: 'Following — Your Teams',
  description: 'Live scores and results for the teams you follow.',
  alternates: { canonical: '/en/following' },
  robots: { index: false },
};

export default function FollowingPage() {
  return <FollowingPageClient locale="en" />;
}
