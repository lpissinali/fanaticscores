/**
 * Today page — Client Component.
 * Keeps real-time Firestore updates exactly as-is.
 * Static SEO content is server-rendered via generateMetadata.
 */

import type { Metadata } from 'next';
import HomePageClient from '@/src/pages/home/HomePage';

export const metadata: Metadata = {
  title: "Today's Football Scores & Live Results",
  description: 'Live football scores, real-time match updates and full-time results across the Premier League, La Liga, Serie A, Bundesliga, Ligue 1 and UEFA Champions League.',
  alternates: { canonical: '/en/today' },
  openGraph: {
    title: "Today's Football Scores & Live Results | FanaticScores",
    description: 'Live football scores and real-time match updates — free, no account required.',
    url: '/en/today',
  },
};

export default function TodayPage() {
  return <HomePageClient locale="en" />;
}
