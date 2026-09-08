import type { Metadata } from "next";
import Link from "next/link";
import { twitterCard } from "@/lib/twitter-card";

import { ThemeCells } from "@/components/ThemeCells";
import { pageOg } from "@/lib/og-pages";

export const metadata: Metadata = {
  title: "Not found",
  description: "That page does not exist. Every book has an address, but this is not one of them.",
  robots: { index: false, follow: true },
  openGraph: { images: [{ url: pageOg("notfound"), width: 1200, height: 630 }] },
  twitter: twitterCard(pageOg("notfound")),
};

/**
 * A site whose headline feature is "it tells you when it doesn't know" should
 * not hand a reader the framework's default error page. This is the same
 * refusal, for a different kind of miss.
 */
export default function NotFound() {
  return (
    <section className="shell pgtop" style={{ paddingBottom: "clamp(50px,7vw,90px)" }}>
      <div className="cell rv in" style={{ padding: "clamp(24px,3.4vw,40px)" }}>
        <span className="badge">
          <b>404</b> Nothing at this address
        </span>
        <h1 className="pg" style={{ marginTop: 20, maxWidth: "22ch" }}>
          That page does not exist.
        </h1>
        <p className="sub" style={{ marginTop: 20, fontSize: 15 }}>
          Every book has an address, but this is not one of them. If you followed a link to a book,
          check that the whole URL came across — the premise travels in the query string, and a
          truncated link loses it.
        </p>
        <div style={{ marginTop: 24, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link className="b1" href="/compose">
            Compose a book
          </Link>
          <Link className="b2" href="/">
            Back to the overview
          </Link>
        </div>
      </div>
      <p className="p" style={{ margin: "clamp(30px,4vw,46px) 0 14px", fontSize: 13 }}>
        Or start from a written thesis
      </p>
      <ThemeCells />
    </section>
  );
}
