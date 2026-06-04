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
  // In dev, proxy /api/af and /api/fd to the deployed Firebase Functions
  // so you can run `next dev` without a local Functions emulator.
  // In production, Firebase Hosting rewrites handle this transparently.
  async rewrites() {
    if (process.env.NODE_ENV === 'development') {
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
    }
    return [];
  },
};

export default nextConfig;
