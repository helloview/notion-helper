import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Skill files are read from disk at runtime (src/lib/skills.ts); make sure
  // they ship with the serverless bundles that need them.
  outputFileTracingIncludes: {
    "/tarot-quiz": ["./skills/**/*"],
    "/api/ai/tarot-quiz": ["./skills/**/*"],
  },
};

export default nextConfig;
