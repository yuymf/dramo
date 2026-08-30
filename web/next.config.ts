import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  async redirects() {
    return [
      {
        source: '/scripts/:id',
        destination: '/projects/:id/scripts',
        permanent: true,
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
