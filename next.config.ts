import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Server mode — needed for API routes and tools
  poweredByHeader: false,
  compress: true,
  images: {
    formats: ["image/avif", "image/webp"],
  },
};

export default nextConfig;
