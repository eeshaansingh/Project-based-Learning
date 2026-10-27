import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prevent Next.js / Turbopack from bundling native Node.js addons.
  // better-sqlite3 is compiled via node-gyp and must be required at runtime
  // from node_modules, not inlined into the server bundle.
  // `serverExternalPackages` is the correct Next.js 15+ API; it works with
  // both Turbopack (default in Next.js 16) and the legacy webpack bundler.
  serverExternalPackages: ['better-sqlite3', '@prisma/adapter-better-sqlite3'],

  // Explicitly acknowledge Turbopack (Next.js 16 default) so the build
  // does not abort when it detects no turbopack config alongside a webpack config.
  turbopack: {},
};

export default nextConfig;

