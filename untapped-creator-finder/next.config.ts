import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pg and the Prisma adapter are server-only native-ish deps; keep them out of the bundle.
  serverExternalPackages: ["pg", "@prisma/adapter-pg"],
};

export default nextConfig;
