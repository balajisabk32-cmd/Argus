import type { Metadata, Viewport } from "next";
import { Syne, Space_Grotesk, Instrument_Serif } from "next/font/google";
import "./globals.css";

/**
 * FONT STRATEGY
 * - Syne (800)      → display / headlines. Geometric, fashion-editorial,
 *                     reads as "premium" and holds huge weights well.
 * - Space Grotesk   → UI / body. Technical, neutral, modern agency feel.
 * - Instrument Serif→ accent / italic pull-quotes. Editorial contrast.
 *
 * These are fetched at build time by next/font (no layout shift, no FOUT).
 */
const display = Syne({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-display",
  display: "swap",
});

const sans = Space_Grotesk({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

const serif = Instrument_Serif({
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
  variable: "--font-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: "SPIDER-VERSE — Into the Web",
  description:
    "An immersive, Awwwards-tier tribute to the Spider-Man multiverse. Built with React Three Fiber, GSAP and Lenis.",
  openGraph: {
    title: "SPIDER-VERSE — Into the Web",
    description: "Cinematic WebGL experience. Dive the canyon. Swing the city.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#050507",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${sans.variable} ${serif.variable}`}
    >
      <body className="grain antialiased">{children}</body>
    </html>
  );
}
