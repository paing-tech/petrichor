import "server-only";
import { z } from "zod";

const databaseEnvSchema = z.object({
  DATABASE_URL: z.url(),
});

const storageEnvSchema = z.object({
  R2_ACCOUNT_ID: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_BUCKET_NAME: z.string().min(1),
  // Public base URL of the bucket (r2.dev subdomain or a custom domain), no trailing slash.
  R2_PUBLIC_URL: z.url().transform((url) => url.replace(/\/+$/, "")),
});

// Parsed lazily so `next build` works without secrets; misconfiguration
// surfaces on first use with a message naming the missing variables.
function parseEnv<T extends z.ZodType>(schema: T, label: string): z.output<T> {
  const result = schema.safeParse(process.env);
  if (!result.success) {
    const missing = result.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Invalid ${label} configuration: ${missing}`);
  }
  return result.data;
}

let databaseEnv: z.output<typeof databaseEnvSchema> | undefined;
let storageEnv: z.output<typeof storageEnvSchema> | undefined;

export function getDatabaseEnv() {
  databaseEnv ??= parseEnv(databaseEnvSchema, "database");
  return databaseEnv;
}

export function getStorageEnv() {
  storageEnv ??= parseEnv(storageEnvSchema, "storage");
  return storageEnv;
}
