import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The product is fully authenticated and reads the session on every request,
  // so Cache Components/partial prefetching add validation constraints without
  // any caching benefit. Kept explicit so the choice is reviewable (DECISIONS D-033).
  cacheComponents: false,
  reactStrictMode: true,
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
