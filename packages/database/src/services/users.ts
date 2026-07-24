import { sql } from "drizzle-orm";
import * as schema from "../schema/index";
import { ModelServiceError, type DbOrTx } from "./audit";

export type CredentialUser = {
  id: string;
  email: string;
};

/**
 * Resolve an authenticated email to the UUID-backed application user.
 * The insert is idempotent and safe when concurrent first logins race.
 */
export async function ensureUserByEmail(
  db: DbOrTx,
  email: string,
): Promise<CredentialUser> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) {
    throw new ModelServiceError("VALIDATION_ERROR", "Email is required", 400);
  }

  const [existing] = await db
    .select({ id: schema.users.id, email: schema.users.email })
    .from(schema.users)
    .where(sql`lower(${schema.users.email}) = ${normalizedEmail}`)
    .limit(1);
  if (existing) return existing;

  const [created] = await db
    .insert(schema.users)
    .values({ email: normalizedEmail })
    .onConflictDoNothing({ target: schema.users.email })
    .returning({ id: schema.users.id, email: schema.users.email });
  if (created) return created;

  const [concurrent] = await db
    .select({ id: schema.users.id, email: schema.users.email })
    .from(schema.users)
    .where(sql`lower(${schema.users.email}) = ${normalizedEmail}`)
    .limit(1);
  if (!concurrent) {
    throw new ModelServiceError("INTERNAL_ERROR", "Unable to resolve authenticated user", 500);
  }
  return concurrent;
}
