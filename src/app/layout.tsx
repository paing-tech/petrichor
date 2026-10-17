import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Serif, Kalam, Outfit } from "next/font/google";
import Link from "next/link";
import { Suspense } from "react";
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
// Kalam for the handwritten message and signature; Outfit for the small print.
const kalam = Kalam({
  variable: "--font-kalam",
  subsets: ["latin"],
  weight: "300",
});

const outfit = Outfit({
  variable: "--font-outfit-family",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Petrichor — music memory cards",
    template: "%s · Petrichor",
  },
  description: "Collectible keepsakes for preserving memories through music.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const siteHeader = (
    // Wordmark centered; the account menu (signed in only) sits on the right.
    <header className="mx-auto grid w-full max-w-6xl grid-cols-[1fr_auto_1fr] items-center px-4 py-3 sm:px-6">
      {/* White on the home page's night sky while its song plays. */}
      <Link
        href="/"
        className="col-start-2 font-serif text-2xl tracking-tight transition-colors duration-700 [html[data-listening]_&]:text-white"
      >
        Petrichor
      </Link>
      {/* Hidden (and out of the tab order) on the home page's night sky while its song plays. */}
      <div className="flex justify-end transition-[opacity,visibility] duration-700 [html[data-listening]_&]:invisible [html[data-listening]_&]:opacity-0">
        <Suspense fallback={null}>
          <AccountMenu />
        </Suspense>
      </div>
    </header>
  );

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} ${kalam.variable} ${outfit.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {siteHeader}
        <main className="flex flex-1 flex-col">{children}</main>
        <Toaster theme="light" position="top-center" />
      </body>
    </html>
  );
}
