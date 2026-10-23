import type { MetadataRoute } from "next";

/** Lets visitors add Petrichor to their home screen and open it like an app (no browser bars). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Petrichor",
    short_name: "Petrichor",
    description: "The Art of Reliving Moments.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      // Android crops icons into its own shapes; this one keeps the P inside the safe zone.
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
