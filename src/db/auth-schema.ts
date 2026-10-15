import { pgSchema, text, uuid } from "drizzle-orm/pg-core";

/**
 * Neon Auth's managed tables live in the `neon_auth` schema. They're declared
 * here only so our tables can reference users; this file is deliberately not
 * exported from schema.ts, so drizzle-kit never tries to create or alter them.
 */
const neonAuth = pgSchema("neon_auth");

export const authUsers = neonAuth.table("user", {
  id: uuid("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  image: text("image"),
});
