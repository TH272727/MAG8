import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // SSE: Next's gzip would buffer event streams under `next start`.
  compress: false,
  // Native module + CLI-spawning SDK must not be bundled by webpack/turbopack.
  serverExternalPackages: ["better-sqlite3", "@anthropic-ai/claude-agent-sdk"],
  // A stray lockfile in the home directory otherwise mis-roots build tracing.
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
