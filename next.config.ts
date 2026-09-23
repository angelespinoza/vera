import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname),
  },
  experimental: {
    serverActions: {
      // Default es 1MB; las fotos de comprobantes suelen pesar más.
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
