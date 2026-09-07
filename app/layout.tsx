import type { Metadata } from "next";
import { Suspense } from "react";
import { Inter } from "next/font/google";

import { Footer } from "@/components/Footer";
import { Nav } from "@/components/Nav";
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
  alternates: { canonical: "/" },
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
    card: "summary_large_image",
    site: SITE.xHandle,
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE.description,
    images: [pageOg("home")],
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
        <div className="wrap">
          <Nav />
          <main id="app">{children}</main>
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
