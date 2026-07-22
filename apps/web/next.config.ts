import type { NextConfig } from "next";

const config: NextConfig = {
  serverExternalPackages: ["drizzle-orm", "postgres"],
};

export default config;
