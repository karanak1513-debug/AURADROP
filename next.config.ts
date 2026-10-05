import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,
  transpilePackages: ['firebase'],
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 2592000,
  },
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      'recharts',
      'qrcode',
      'three',
      'framer-motion',
      'clsx',
      'tailwind-merge',
    ],
  },
  async headers() {
    return [
      {
        source: '/:all*(svg|jpg|png|webp|ico|woff|woff2)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
