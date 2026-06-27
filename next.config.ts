import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produce a minimal, self-contained server build for the Docker image.
  output: "standalone",
  experimental: {
    // Recipe image uploads go through a Server Action, whose request body
    // defaults to a 1 MB cap. Raise it to comfortably fit the 5 MB image
    // limit enforced in src/lib/storage.ts (MAX_IMAGE_BYTES).
    serverActions: {
      bodySizeLimit: "6mb",
    },
  },
};

export default nextConfig;
