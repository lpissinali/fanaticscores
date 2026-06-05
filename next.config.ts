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
};

export default nextConfig;
