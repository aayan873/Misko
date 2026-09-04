import type { Metadata } from "next";
import { Bricolage_Grotesque, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import Nav from "@/components/Nav";
import "./globals.css";

// A characterful display face for headlines — deliberately not Inter/Space
// Grotesk (the "safe" AI-generated-UI default) and not a serif either, which
// kept reading as "academic worksheet" even after the composition moved away
// from that. Bricolage has real personality in headline weights while staying
// unambiguously a UI typeface, not a decorative one.
const display = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-display",
  display: "swap",
});
const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Misko — the tutor that checks if you earned it",
    // Each route sets its own title via a route-level layout.tsx (metadata
    // exports need a server component, and every page here is "use client")
    // — otherwise every tab/screen-reader page title was identical, making
    // them indistinguishable from each other.
    template: "%s — Misko",
  },
  description:
    "An Algebra I tutor that diagnoses the misconception behind a wrong answer, and quietly double-checks correct answers that might be lucky guesses instead of real understanding.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${display.variable} ${plexSans.variable} ${plexMono.variable} font-body antialiased min-h-screen`}
      >
        <Nav />
        <main>{children}</main>
      </body>
    </html>
  );
}
