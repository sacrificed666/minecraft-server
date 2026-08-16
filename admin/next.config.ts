import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Modrinth serves project icons from its CDN; nothing else is remote.
  images: { remotePatterns: [{ protocol: "https", hostname: "cdn.modrinth.com" }] },
  reactCompiler: true,
};

export default nextConfig;
