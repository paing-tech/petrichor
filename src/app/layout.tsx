import type { Metadata } from "next";
import { Cormorant_Garamond, Geist, Geist_Mono, Instrument_Serif, Kalam, Outfit } from "next/font/google";
import Link from "next/link";
import { Suspense } from "react";
import { AccountMenu } from "@/components/account/account-menu";
import { SiteHeaderGate } from "@/components/site-header-gate";
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

// Card typefaces: Kalam for the handwritten message, Cormorant Garamond for
// lyrics and the signature, Outfit for the small print.
const kalam = Kalam({
  variable: "--font-kalam",
  subsets: ["latin"],
  weight: "300",
});

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["400", "500"],
  style: "italic",
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
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
      <Link href="/" className="font-serif text-2xl tracking-tight">
        Petrichor
      </Link>
      <nav className="flex items-center gap-5">
        <Link
          href="/create"
          className="text-muted-foreground hover:text-foreground text-sm font-medium transition-colors"
        >
          Create a card
        </Link>
        <Suspense fallback={<div className="size-8" />}>
          <AccountMenu />
        </Suspense>
      </nav>
    </header>
  );

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} ${kalam.variable} ${cormorant.variable} ${outfit.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {/* Hidden while creating a card. Reading the path is request data on dynamic
            routes, so it sits in Suspense with the header itself as the fallback. */}
        <Suspense fallback={siteHeader}>
          <SiteHeaderGate>{siteHeader}</SiteHeaderGate>
        </Suspense>
        <main className="flex flex-1 flex-col">{children}</main>
        <Toaster theme="light" position="top-center" />
      </body>
    </html>
  );
}
