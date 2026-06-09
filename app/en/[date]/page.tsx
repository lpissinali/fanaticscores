import type { Metadata } from 'next';
import HomePageClient from '@/src/views/home/HomePage';
import { getMatchdayDoc } from '@/lib/serverApi/matchdayDoc';

interface Props { params: Promise<{ date: string }> }

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Re-render at most every 60s; past dates are effectively static, today/future
// stay reasonably fresh for crawlers without per-request Firestore reads.
export const revalidate = 60;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { date } = await params;
  // Format date for display e.g. "2026-06-05" → "Friday, June 5 2026"
  const parsed = new Date(date + 'T12:00:00Z');
  const label = isNaN(parsed.getTime())
    ? date
    : parsed.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const title = `Football Scores — ${label}`;
  const description = `Football scores and results for ${label}. Live match updates across Premier League, La Liga, Serie A and more.`;
  return {
    title,
    description,
    alternates: { canonical: `/en/${date}` },
    openGraph: { title, description, url: `/en/${date}` },
    twitter: { title, description },
  };
}

export default async function DatePage({ params }: Props) {
  const { date } = await params;
  // Server-render this specific date's fixtures so each date page has unique,
  // crawlable content (only for well-formed YYYY-MM-DD segments).
  const initialDoc = DATE_RE.test(date) ? await getMatchdayDoc(date) : null;
  return <HomePageClient locale="en" initialDoc={initialDoc} />;
}
