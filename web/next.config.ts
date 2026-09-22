import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  devIndicators: false,
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
