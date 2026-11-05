import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "covers.openlibrary.org" },
    ],
  },
  experimental: {
    // Book photos are uploaded through server actions (up to 4 × 5 MB, checked in lib/storage).
    serverActions: { bodySizeLimit: "21mb" },
  },
};

export default nextConfig;
