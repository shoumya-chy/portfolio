import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin workspace root when multiple lockfiles exist (avoids wrong app dir inference).
  turbopack: {
    root: process.cwd(),
  },
  // Server mode — needed for API routes and tools
  poweredByHeader: false,
  compress: true,
  images: {
    formats: ["image/avif", "image/webp"],
  },
};

export default nextConfig;
