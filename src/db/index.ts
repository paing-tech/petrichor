import "server-only";
import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import { getDatabaseEnv } from "@/lib/env";
import * as schema from "./schema";

let db: NeonHttpDatabase<typeof schema> | undefined;

export function getDb() {
  db ??= drizzle(neon(getDatabaseEnv().DATABASE_URL), { schema });
  return db;
}
