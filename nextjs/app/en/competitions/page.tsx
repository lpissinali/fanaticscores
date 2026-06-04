import type { Metadata } from 'next';
import CompetitionsPageClient from '@/src/pages/competitions/CompetitionsPage';

export const metadata: Metadata = {
  title: 'Football Competitions & Leagues',
  description: 'Browse all football competitions — Premier League, La Liga, Serie A, Bundesliga, Champions League and more.',
  alternates: { canonical: '/en/competitions' },
};

export default function CompetitionsPage() {
  return <CompetitionsPageClient locale="en" />;
}
