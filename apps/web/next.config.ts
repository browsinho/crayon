import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@crayon/types"],
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  // Mark Node.js native dependencies as external for server-side only
  serverExternalPackages: [
    "@crayon/core",
    "dockerode",
    "playwright",
    "playwright-core",
    "anchorbrowser",
    "ssh2",
    "cpu-features",
    "unzipper",
    "archiver",
  ],
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Don't bundle these server-only packages
      const externals = config.externals || [];
      const externalPackages = [
        "@crayon/core",
        "dockerode",
        "playwright",
        "playwright-core",
        "anchorbrowser",
        "ssh2",
        "cpu-features",
        "unzipper",
        "archiver",
        "chromium-bidi",
      ];

      if (Array.isArray(externals)) {
        config.externals = [...externals, ...externalPackages];
      } else {
        config.externals = [externals, ...externalPackages];
      }
    }
    return config;
  },
};

export default nextConfig;
