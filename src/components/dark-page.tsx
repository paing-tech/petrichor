"use client";

import { useEffect } from "react";

const SET_FLAG = "document.documentElement.setAttribute('data-dark-page','')";

/**
 * Turns the whole page black (body and header, see globals.css) while the page that renders
 * this is showing, and back when it's left. A flag on the html element, set by an effect, so it
 * clears when the page is left (even when Next keeps the page around, hidden, for going back);
 * the inline script sets it before the first paint, so a direct visit doesn't flash white.
 */
export function DarkPage() {
  useEffect(() => {
    document.documentElement.setAttribute("data-dark-page", "");
    return () => document.documentElement.removeAttribute("data-dark-page");
  }, []);
  return <script dangerouslySetInnerHTML={{ __html: SET_FLAG }} />;
}
