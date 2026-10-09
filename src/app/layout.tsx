import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import Link from "next/link";
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

export const metadata: Metadata = {
  title: {
    default: "Petrichor — music memory cards",
    template: "%s · Petrichor",
  },
  description: "Turn a song and a moment into a collectible card you can share with anyone.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
          <Link href="/" className="font-serif text-2xl tracking-tight">
            Petrichor
          </Link>
          <Link
            href="/create"
            className="text-muted-foreground hover:text-foreground text-sm font-medium transition-colors"
          >
            Create a card
          </Link>
        </header>
        <main className="flex flex-1 flex-col">{children}</main>
        <Toaster theme="light" position="top-center" />
      </body>
    </html>
  );
}
