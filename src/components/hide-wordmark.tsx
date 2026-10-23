"use client";

import { useEffect } from "react";

const SET_FLAG = "document.documentElement.setAttribute('data-no-wordmark','')";

/**
 * Hides the header's "Petrichor" wordmark (keeping its space) while the page that renders this
 * is showing, for pages that show the brand themselves. Like DarkPage: a flag on the html
 * element, set by an effect so it clears when the page is left, and by an inline script so a
 * direct visit never shows it.
 */
export function HideWordmark() {
  useEffect(() => {
    document.documentElement.setAttribute("data-no-wordmark", "");
    return () => document.documentElement.removeAttribute("data-no-wordmark");
  }, []);
  return <script dangerouslySetInnerHTML={{ __html: SET_FLAG }} />;
}
