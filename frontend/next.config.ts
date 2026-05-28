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
   * Output file tracing + Turbopack root.
   *
   * Pointed at the WORKSPACE root (one level above `frontend/`), not at
   * `frontend/` itself. The previous, narrower setting broke local production
   * builds in workspace mode: npm hoists shared deps (incl. Next.js itself, plus
   * transitive packages like `hasown`, `debug`, `get-intrinsic`) up to
   * `<repo>/node_modules/`, where Turbopack — pinned to `frontend/` — could not
   * find them and emitted "module not found" errors.
   *
   * On Vercel the Root Directory is `frontend`, so `frontend/`'s parent is the
   * deploy working directory which contains no node_modules — the `..`
   * resolution is harmless. Locally it allows Turbopack to walk up to the real
   * workspace root and resolve hoisted dependencies.
   */
  outputFileTracingRoot: path.resolve(__dirname, '..'),

  turbopack: {
    root: path.resolve(__dirname, '..'),
  },
};

export default nextConfig;
