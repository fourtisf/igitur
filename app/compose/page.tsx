import type { Metadata } from "next";

import { pageOg } from "@/lib/og-pages";
import { SITE } from "@/lib/site";

import { normalizePremise } from "@/lib/premise";
import { Composer } from "./Composer";

export const metadata: Metadata = {
  title: "Compose a book",
  description:
    "State one belief about the next decade. Igitur matches it against 26 written theses and returns a weighted portfolio with a reason on every holding.",
  alternates: { canonical: "/compose" },
  openGraph: {
    url: "/compose",
    title: `Compose a book — ${SITE.name}`,
    description:
      "State one belief about the next decade and get a weighted portfolio with a reason on every holding.",
    images: [{ url: pageOg("compose"), width: 1200, height: 630 }],
  },
  twitter: { card: "summary_large_image", images: [pageOg("compose")] },
};

export default async function ComposePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  return (
    <section className="shell pgtop" style={{ paddingBottom: "clamp(50px,7vw,90px)" }}>
      <span className="kick rv">Compose</span>
      <h1 className="pg rv" style={{ marginTop: 12, maxWidth: "16ch" }}>
        State the claim first.
      </h1>
      <p className="sub rv" style={{ marginTop: 16 }}>
        Write it the way you would say it out loud. Name a constraint, an industry or a resource —
        that is what the matcher reads.
      </p>
      <Composer prefill={normalizePremise(sp.p)} />
    </section>
  );
}
