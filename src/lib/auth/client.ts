"use client";

import { createAuthClient } from "@neondatabase/auth/next";

/** Browser auth client; talks to Neon Auth through the same-origin /api/auth proxy. */
export const authClient = createAuthClient();
