import type { NextRequest } from "next/server";
import { getAuth } from "@/lib/auth/server";

// Proxies the browser auth client to Neon Auth. Resolved per request so a build
// without auth secrets still succeeds.
type Context = { params: Promise<{ path: string[] }> };
const handle = (method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH") => (request: NextRequest, context: Context) =>
  getAuth().handler()[method](request, context);

export const GET = handle("GET");
export const POST = handle("POST");
export const PUT = handle("PUT");
export const DELETE = handle("DELETE");
export const PATCH = handle("PATCH");
