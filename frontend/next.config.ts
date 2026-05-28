import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: process.env.DOCKER_BUILD === "true" ? "standalone" : undefined,

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "http", hostname: "localhost" },
    ],
  },

  experimental: {
    optimizePackageImports: ["lucide-react", "recharts"],
  },

  /**
   * Explicitly set the output file tracing root to this package directory.
   *
   * WHY: When a monorepo has a package-lock.json at the repo root AND another
   * one inside the Next.js package folder, Next.js 16 misidentifies the
   * workspace root and emits a warning on every build. Pointing
   * `outputFileTracingRoot` at __dirname (the frontend/ folder) silences the
   * warning and ensures that only files reachable from this package are
   * included in the output file trace — important for the `standalone` output
   * used in Docker deployments.
   */
  outputFileTracingRoot: path.resolve(__dirname),

  /**
   * Turbopack root — same reasoning as above but for Turbopack's module
   * resolution graph (used by `next dev` and `next build` in Next.js 16+).
   */
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
