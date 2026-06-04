import HomePageClient from '@/src/pages/home/HomePage';

interface Props { params: Promise<{ date: string }> }

export default async function DatePage({ params }: Props) {
  const { date } = await params;
  return <HomePageClient locale="en" />;
}
