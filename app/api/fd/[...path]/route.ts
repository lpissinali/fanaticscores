import { NextRequest, NextResponse } from 'next/server';

const BASE = `https://us-central1-${process.env.FIREBASE_PROJECT_ID ?? 'fanaticscores-b6af4'}.cloudfunctions.net`;

async function proxy(req: NextRequest, path: string[]) {
  const search = req.nextUrl.search;
  const upstream = `${BASE}/fdProxy/api/fd/${path.join('/')}${search}`;
  try {
    const res = await fetch(upstream, {
      method: req.method,
      headers: { 'Content-Type': 'application/json' },
      body: req.method !== 'GET' && req.method !== 'HEAD' ? await req.text() : undefined,
      next: { revalidate: 60 },
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'upstream error' }, { status: 502 });
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return proxy(req, path);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return proxy(req, path);
}
