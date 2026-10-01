import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Article image uploads go through a server action; the form downscales
      // them first, but a detailed photo can still pass the 1 MB default.
      bodySizeLimit: "2mb",
    },
  },
};

export default nextConfig;
