import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Every page in Scope is per-user and authenticated, so a prerendered static
  // shell offers little. Dynamic rendering keeps the auth model simple.
  // See docs/architecture.md (section 8).
  cacheComponents: false,
  typedRoutes: true,
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
