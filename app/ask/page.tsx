import type { Metadata } from "next";
import Link from "next/link";

import { AskChat } from "@/components/AskChat";
import { modelIsReal, modelMatcherConfigured } from "@/lib/matcher/llm";
import { pageOg } from "@/lib/og-pages";
import { SITE } from "@/lib/site";
import { twitterCard } from "@/lib/twitter-card";
import { NAMES, THEMES, UNIVERSE } from "@/lib/universe";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Ask",
  description:
    "Ask about any of Igitur's 26 written theses, the conviction score behind any weight, or how the method works. It answers from what is published, and says so when it does not know.",
  alternates: { canonical: "/ask" },
  openGraph: {
    url: "/ask",
    title: `Ask — ${SITE.name}`,
    description: "Answers from the published theses and the methodology. Research only.",
    images: [{ url: pageOg("method"), width: 1200, height: 630 }],
  },
  twitter: twitterCard(pageOg("method")),
};

export default async function AskPage() {
  // Set is not the same as accepted. A chat box that answers every question
  // with an error is worse than a page that says plainly there is no assistant
  // here — and /api/ask still says exactly why, for whoever has to fix it.
  const ready = await modelIsReal();
  const rejected = modelMatcherConfigured() && !ready;

  return (
    <section className="shell pgtop" style={{ paddingBottom: "clamp(50px,7vw,90px)" }}>
      <span className="kick rv">Ask</span>
      <h1 className="pg rv" style={{ marginTop: 12, maxWidth: "18ch" }}>
        The reasoning, without the reading.
      </h1>
      <p className="sub rv" style={{ marginTop: 16, maxWidth: "58ch" }}>
        {THEMES.length} written theses, {NAMES} names with a reason each, and a published
        methodology — spread across six pages. Ask instead.
      </p>

      {ready ? (
        /* The tickers and theses travel to the browser so an answer can end in
           something the reader can click. Deciding that in the page rather than
           in the model keeps every link real: the model writes prose, the site
           decides where its own pages are. */
        <AskChat
          tickers={[...new Set(UNIVERSE.map((a) => a.t))].filter((t) => t.length > 1 && t !== "NOW")}
          themes={THEMES.map((t) => ({ id: t.id, name: t.name, claim: t.claim }))}
        />
      ) : (
        /* Derived, not written beside the feature: a page claiming an assistant
           this deployment does not have is the same failure /status exists to
           prevent. */
        <div className="cell rv" style={{ marginTop: 28, padding: "clamp(24px,3.4vw,40px)" }}>
          <h3>Not configured on this deployment.</h3>
          <p className="p" style={{ marginTop: 10, maxWidth: "50ch" }}>
            {rejected
              ? `The assistant needs a model key this service accepts, and the one on this
                 server is being refused. Everything it would answer from is published and
                 readable directly.`
              : `The assistant needs a model key, and this server has none. Everything it would
                 answer from is published and readable directly.`}
          </p>
          <div className="hero-cta" style={{ justifyContent: "flex-start", marginTop: 20 }}>
            <Link className="b1" href="/universe">
              The universe
            </Link>
            <Link className="b2" href="/method">
              The methodology
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}
