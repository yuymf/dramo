import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: '/scripts/:id',
        destination: '/projects/:id/scripts',
        permanent: true,
      },
    ];
  },
  async rewrites() {
    return [];
  },
  experimental: {
    externalDir: true,
    // 设置代理超时时间（开发环境）
    proxyTimeout: 100000, // 100 seconds
  },
  webpack: (config) => {
    // Exclude backend directory from Next.js build
    config.watchOptions = {
      ...config.watchOptions,
      ignored: ['**/server/**'],
    };
    return config;
  },
};

export default nextConfig;
