import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produce a minimal, self-contained server build for the Docker image.
  output: "standalone",
};

export default nextConfig;
