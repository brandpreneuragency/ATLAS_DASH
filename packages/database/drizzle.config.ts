import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgresql://modelmonitor:modelmonitor@localhost:5433/modelmonitor",
  },
  verbose: true,
  strict: true,
});
