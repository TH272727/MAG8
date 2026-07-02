import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // SSE: Next's gzip would buffer event streams under `next start`.
  compress: false,
  // Native module + CLI-spawning SDK must not be bundled by webpack/turbopack.
  serverExternalPackages: ["better-sqlite3", "@anthropic-ai/claude-agent-sdk"],
};

export default nextConfig;
