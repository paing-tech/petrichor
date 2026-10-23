import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Instrument_Serif, La_Belle_Aurore, Outfit } from "next/font/google";
import Link from "next/link";
import { Suspense, ViewTransition } from "react";
import { AccountMenu } from "@/components/account/account-menu";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

// Card typefaces: Instrument Serif (above) for the song title and, in italic, the lyrics;
// La Belle Aurore for the handwritten message and signature; Outfit for the small print.
const laBelleAurore = La_Belle_Aurore({
  variable: "--font-la-belle-aurore",
  subsets: ["latin"],
  weight: "400",
});

const outfit = Outfit({
  variable: "--font-outfit-family",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Petrichor",
    template: "%s",
  },
  description: "The Art of Reliving Moments.",
  // Opened from the home screen on iPhone: full screen like an app, named "Petrichor".
  appleWebApp: { capable: true, title: "Petrichor", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  // Draw edge to edge (under the notch and home bar); safe-area padding keeps content clear.
  viewportFit: "cover",
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const siteHeader = (
    // Wordmark centered; the account menu (signed in only) sits on the right.
    // Stays put while pages change (see the view-transition rules in globals.css), and clears
    // the notch / status bar when the app runs full screen.
    <header
      className="mx-auto grid w-full max-w-6xl grid-cols-[1fr_auto_1fr] items-center px-[max(1rem,env(safe-area-inset-left))] pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 sm:px-6"
      style={{ viewTransitionName: "site-header" }}
    >
      {/* White on the home page's night sky while its song plays. */}
      <Link
        href="/"
        className="col-start-2 font-serif text-2xl tracking-tight transition-colors duration-700 [html[data-dark-page]_&]:text-white [html[data-listening]_&]:text-white"
      >
        Petrichor
      </Link>
      {/* Hidden (and out of the tab order) on the home page's night sky while its song plays. */}
      <div className="flex items-center justify-end gap-2 transition-[opacity,visibility] duration-700 [html[data-listening]_&]:invisible [html[data-listening]_&]:opacity-0">
        {/* Page-specific actions (e.g. a card page's share button) are placed here. */}
        <div id="header-actions" className="flex items-center" />
        <Suspense fallback={null}>
          <AccountMenu />
        </Suspense>
      </div>
    </header>
  );

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} ${laBelleAurore.variable} ${outfit.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col pb-[env(safe-area-inset-bottom)]">
        {siteHeader}
        <main className="flex flex-1 flex-col">
          {/* Pages cross-fade into each other instead of swapping at once. */}
          <ViewTransition>{children}</ViewTransition>
        </main>
        <Toaster theme="light" position="top-center" />
      </body>
    </html>
  );
}
