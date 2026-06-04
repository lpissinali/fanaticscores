import HomePageClient from '@/src/views/home/HomePage';

interface Props { params: Promise<{ date: string }> }

export default async function DatePage({ params }: Props) {
  const { date } = await params;
  return <HomePageClient locale="en" />;
}
