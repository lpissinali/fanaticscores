import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Next.js incorrectly generates src/app paths in .next/types/validator.ts
  // when a legacy src/ directory exists alongside the new app/ dir.
  // The compilation is fine; only the auto-generated validator has wrong paths.
  typescript: { ignoreBuildErrors: true },

  // Allow team/competition crests from api-football CDN
  images: {
    remotePatterns: [
      { hostname: 'media.api-sports.io' },
      { hostname: 'media-3.api-sports.io' },
      { hostname: 'media-4.api-sports.io' },
    ],
  },
  // Proxy client-side API calls to Firebase Functions.
  // Applies in all environments — Firebase App Hosting does not inherit
  // the classic firebase.json hosting rewrites.
  async rewrites() {
    const project = process.env.FIREBASE_PROJECT_ID ?? 'fanaticscores-b6af4';
    const region  = 'us-central1';
    const base    = `https://${region}-${project}.cloudfunctions.net`;
    return [
      {
        source:      '/api/af/:path*',
        destination: `${base}/afProxy/api/af/:path*`,
      },
      {
        source:      '/api/fd/:path*',
        destination: `${base}/fdProxy/api/fd/:path*`,
      },
      {
        source:      '/api/fetchMatchday',
        destination: `${base}/fetchMatchdayHttp`,
      },
      {
        source:      '/api/captionRewrite',
        destination: `${base}/captionRewrite`,
      },
    ];
  },
};

export default nextConfig;
