import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Monorepo: trace from the workspace root so workspace:* packages
  // (like @flowdesk/shared-types) are included in the standalone build.
  outputFileTracingRoot: path.join(__dirname, "../.."),
};

export default nextConfig;
