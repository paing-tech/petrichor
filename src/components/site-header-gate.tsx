"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

/** Pages that take the full screen without the site header (card creation). */
const HEADERLESS_PREFIXES = ["/create"];

export function SiteHeaderGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (HEADERLESS_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) return null;
  return children;
}
