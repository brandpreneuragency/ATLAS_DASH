import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema/index.js";

const url = process.env.DATABASE_URL ?? "postgresql://modelmonitor:modelmonitor@localhost:5433/modelmonitor";

const client = postgres(url, { max: 10 });

export const db = drizzle(client, { schema });
export { schema };
export type Database = typeof db;
