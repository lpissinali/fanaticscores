/**
 * Today page — Server Component.
 * Reads today's matchday doc from Firestore server-side and seeds the client
 * view so the initial HTML contains real fixtures + AI brief (crawlable),
 * while the client keeps the real-time Firestore updates exactly as-is.
 */

import type { Metadata } from 'next';
import HomePageClient from '@/src/views/home/HomePage';
import { getMatchdayDoc } from '@/lib/serverApi/matchdayDoc';

// Render on-demand (not at build time): today's scores must be fresh, and it
// keeps the Admin SDK out of `next build`. One warm instance (minInstances: 1)
// keeps this fast for crawlers; each render is a single Firestore doc read.
export const dynamic = 'force-dynamic';

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

export default async function TodayPage() {
  const date = new Date().toISOString().slice(0, 10);
  const initialDoc = await getMatchdayDoc(date);
  return <HomePageClient locale="en" initialDoc={initialDoc} />;
}
