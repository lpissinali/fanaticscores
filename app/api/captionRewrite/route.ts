import { NextRequest, NextResponse } from 'next/server';

const BASE = `https://us-central1-${process.env.FIREBASE_PROJECT_ID ?? 'fanaticscores-b6af4'}.cloudfunctions.net`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const res = await fetch(`${BASE}/captionRewrite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'upstream error' }, { status: 502 });
  }
}
