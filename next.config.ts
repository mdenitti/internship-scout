import type { NextConfig } from 'next';

/**
 * `pg` is a native-ish Node dependency that must not be bundled by webpack/turbopack
 * for the server runtime. It is only ever loaded lazily when DATABASE_URL is set.
 */
const nextConfig: NextConfig = {
  serverExternalPackages: ['pg'],
  typedRoutes: false,
  experimental: {
    // Keeps server action / route handler payloads sane for our small JSON bodies.
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
};

export default nextConfig;
