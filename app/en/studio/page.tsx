import type { Metadata } from 'next';
import StudioLoader from '@/src/components/shared/StudioLoader/StudioLoader';

export const metadata: Metadata = {
  title: 'Share Studio — Create Football Match Cards',
  description: 'Turn any football match into a shareable card. Pick a match, choose a style, and share it instantly.',
  alternates: { canonical: '/en/studio' },
  openGraph: {
    title: 'Share Studio | FanaticScores',
    description: 'Turn any football match into a shareable card.',
    url: '/en/studio',
  },
};

export default function StudioPage() {
  return <StudioLoader locale="en" />;
}
