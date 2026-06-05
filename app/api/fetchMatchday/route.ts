import { NextRequest, NextResponse } from 'next/server';

const BASE = `https://us-central1-${process.env.FIREBASE_PROJECT_ID ?? 'fanaticscores-b6af4'}.cloudfunctions.net`;

export async function GET(req: NextRequest) {
  const search = req.nextUrl.search;
  try {
    const res = await fetch(`${BASE}/fetchMatchdayHttp${search}`, {
      headers: { 'Content-Type': 'application/json' },
      next: { revalidate: 60 },
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'upstream error' }, { status: 502 });
  }
}
