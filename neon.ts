import { defineConfig } from "@neon/config/v1";

export default defineConfig({
  // Managed Better Auth: users and sessions live in the `neon_auth` schema.
  auth: true,
});
