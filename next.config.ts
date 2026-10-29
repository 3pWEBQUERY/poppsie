import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Personalisierte Community: Seiten lesen fast immer Session und Herkunftsland.
  cacheComponents: false,
  serverExternalPackages: ["sharp", "@node-rs/argon2", "pg"],
  experimental: {
    serverActions: { bodySizeLimit: "12mb" },
  },
  images: { unoptimized: true },
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
