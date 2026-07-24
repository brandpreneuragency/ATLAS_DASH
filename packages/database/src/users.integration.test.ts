import { afterAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema/index";
import { ensureUserByEmail } from "./services/users";
import type { Db } from "./services/audit";

function resolveUrl(): string {
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.trim() !== "") {
    return process.env.DATABASE_URL;
  }
  return "postgresql://modelmonitor:modelmonitor@127.0.0.1:5433/modelmonitor";
}

const client = postgres(resolveUrl(), { max: 5 });
const db = drizzle(client, { schema }) as Db;
const testEmail = `mmtest:credential-${crypto.randomUUID()}@example.invalid`;

afterAll(async () => {
  await client`DELETE FROM users WHERE email = ${testEmail}`;
  await client.end({ timeout: 2 });
});

describe("credential user resolution", () => {
  it("normalizes an email and returns one UUID-backed user across concurrent calls", async () => {
    const users = await Promise.all([
      ensureUserByEmail(db, `  ${testEmail.toUpperCase()}  `),
      ensureUserByEmail(db, testEmail),
      ensureUserByEmail(db, testEmail),
    ]);

    expect(new Set(users.map((user) => user.id)).size).toBe(1);
    expect(users.every((user) => user.email === testEmail)).toBe(true);
    expect(users[0].id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );

    const rows = await client<{ count: number }[]>`
      SELECT count(*)::int AS count FROM users WHERE email = ${testEmail}
    `;
    expect(rows[0].count).toBe(1);
  });
});
