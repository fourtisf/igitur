import type { Metadata } from "next";
import { twitterCard } from "@/lib/twitter-card";

import { pageOg } from "@/lib/og-pages";
import { SITE } from "@/lib/site";

import { normalizePremise } from "@/lib/premise";
import Link from "next/link";

import { bookHref } from "@/lib/routes";
import { THEMES, THEME_BY_ID, UNIVERSE_VERSION } from "@/lib/universe";
import { Composer } from "@/components/Composer";

export const metadata: Metadata = {
  title: "Compose a portfolio",
  description:
    "State one belief about the next decade. Igitur matches it against 26 written theses and returns a weighted portfolio with a reason on every holding.",
  alternates: { canonical: "/compose" },
  openGraph: {
    url: "/compose",
    title: `Compose a portfolio — ${SITE.name}`,
    description:
      "State one belief about the next decade and get a weighted portfolio with a reason on every holding.",
    images: [{ url: pageOg("compose"), width: 1200, height: 630 }],
  },
  twitter: twitterCard(pageOg("compose")),
};

/** Three claims that build, chosen to be visibly unalike so the field does not
 *  read as if it only accepts one subject. */
const EXAMPLES = ["water", "nuclear", "robotics"] as const;

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

      {/* The instruction above is abstract until it sits next to a sentence.
          Readers arriving here type "hello" and get refused, which is correct
          and teaches nothing, so the worked example goes in front of the field
          rather than behind a failure. Each chip is a real theme claim and
          builds a book on the first click. */}
      <div className="egs rv" style={{ marginTop: 18 }}>
        <span className="faint">For example</span>
        {EXAMPLES.map((id) => {
          const th = THEME_BY_ID.get(id);
          return th ? (
            <Link
              key={id}
              className="chip"
              href={bookHref(th.claim, [], { universe: UNIVERSE_VERSION })}
              title={th.claim}
            >
              {th.claim.length > 58 ? th.claim.slice(0, 57).trimEnd() + "…" : th.claim}
            </Link>
          ) : null;
        })}
      </div>

      <Composer
        prefill={normalizePremise(sp.p)}
        claims={Object.fromEntries(THEMES.map((t) => [t.id, t.claim]))}
        counts={Object.fromEntries(THEMES.map((t) => [t.id, t.assets.length]))}
      />
    </section>
  );
}
