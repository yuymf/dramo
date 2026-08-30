import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  devIndicators: {
    position: "top-right",
  },
  async redirects() {
    return [
      {
        source: '/scripts/:id',
        destination: '/projects/:id/screenplay',
        permanent: true,
      },
      {
        source: '/projects/:id/scripts/hollywood',
        destination: '/projects/:id/screenplay',
        permanent: false,
      },
      {
        source: '/projects/:id/scripts/dialogue',
        destination: '/projects/:id/screenplay',
        permanent: false,
      },
      {
        source: '/projects/:id/scripts/script',
        destination: '/projects/:id/screenplay',
        permanent: false,
      },
      {
        source: '/projects/:id/storyboard',
        destination: '/projects/:id/screenplay',
        permanent: false,
      },
    ];
  },
  experimental: {
    externalDir: true,
    proxyTimeout: 600000,
  },
  webpack: (config) => {
    config.watchOptions = {
      ...config.watchOptions,
      ignored: ['**/server/**'],
    };
    return config;
  },
};

export default nextConfig;
