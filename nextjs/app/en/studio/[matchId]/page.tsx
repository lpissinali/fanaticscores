import StudioLoader from '@/src/components/shared/StudioLoader/StudioLoader';

interface Props { params: Promise<{ matchId: string }> }

export default async function StudioMatchPage({ params }: Props) {
  const { matchId } = await params;
  return <StudioLoader locale="en" matchId={matchId} />;
}
