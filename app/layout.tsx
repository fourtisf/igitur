import type { Metadata } from "next";
import { Suspense } from "react";
import { Inter } from "next/font/google";
import { twitterCard } from "@/lib/twitter-card";

import { Footer } from "@/components/Footer";
import { Nav } from "@/components/Nav";
import { TokenStrip } from "@/components/TokenStrip";
import { Reveal } from "@/components/Reveal";
import { Toast } from "@/components/Toast";
import { pageOg } from "@/lib/og-pages";
import { SITE } from "@/lib/site";
import "./globals.css";

/** Inter only, 300–800. HANDOFF.md §11. Self-hosted by next/font, so there is
 *  no render-blocking request to Google and no layout shift. */
const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  // Every canonical, OG and sitemap URL resolves against this.
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.name} — ${SITE.tagline}`,
    // Each page sets its own title; this keeps the wordmark on all of them.
    template: `%s — ${SITE.name}`,
  },
  description: SITE.description,
  applicationName: SITE.name,
  alternates: {
    canonical: "/",
    // Feed discovery, site-wide. The record's whole value is in being
    // revisited, and a reader who subscribes never has to remember a URL.
    types: { "application/rss+xml": [{ url: "/feed.xml", title: "Igitur — the record" }] },
  },
  openGraph: {
    type: "website",
    siteName: SITE.name,
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE.description,
    url: "/",
    // Inherited by every page that does not set its own, so no route ever
    // shares as a blank card — §6.2 applies to the whole site, not just books.
    images: [{ url: pageOg("home"), width: 1200, height: 630, alt: SITE.tagline }],
  },
  twitter: {
    ...twitterCard(pageOg("home")),
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE.description,
  },
  robots: { index: true, follow: true },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        {/* The three depth layers, in this order and nothing else. §11 */}
        <div className="glow" />
        <div className="grain" />
        {/* 24 focusable elements sat between the top of every page and its
            content. This is the way past them. */}
        <a className="skip" href="#app">
          Skip to content
        </a>
        <div className="wrap">
          <TokenStrip />
          <Nav />
          <main id="app" tabIndex={-1}>
            {children}
          </main>
          <Footer />
        </div>
        <Toast />
        <Suspense fallback={null}>
          <Reveal />
        </Suspense>
      </body>
    </html>
  );
}
