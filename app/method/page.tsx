import type { Metadata } from "next";

import { pageOg } from "@/lib/og-pages";
import Link from "next/link";

import { NAMES, REVIEWED, THEMES } from "@/lib/universe";

export const metadata: Metadata = {
  title: "Methodology",
  description:
    "How every number on Premise was produced — matching, weighting, where conviction scores come from, and the places the method is weak.",
  alternates: { canonical: "/method" },
  openGraph: {
    url: "/method",
    title: "Methodology — Premise",
    description:
      "Matching, weighting, conviction, and the places the method is weak. Published in full, including its own weaknesses.",
    images: [{ url: pageOg("method"), width: 1200, height: 630 }],
  },
  twitter: { card: "summary_large_image", images: [pageOg("method")] },
};

export default function MethodPage() {
  return (
    <section className="shell pgtop" style={{ paddingBottom: "clamp(50px,7vw,90px)" }}>
      <span className="kick rv">Methodology</span>
      <h1 className="pg rv" style={{ marginTop: 12, maxWidth: "20ch" }}>
        How every number on this site was produced.
      </h1>
      <p className="sub rv" style={{ marginTop: 16 }}>
        The whole product rests on a set of judgements. Here they are, including the places where
        the method is weak.
      </p>
      <div className="bento rv">
        <div className="cell c3">
          <h3>1. Matching a premise to a theme</h3>
          <p className="p" style={{ marginTop: 8 }}>
            Each of the {THEMES.length} themes carries a keyword list and a list of negative terms.
            An exact word match scores 3, a matched phrase scores 6, and each negative term found
            subtracts 7. The highest scoring theme leads. A second theme can contribute two names if
            it scores at least 55% of the leader, but its conviction scores are discounted by 30% so
            it can never take the lead position.
          </p>
          <p className="p" style={{ marginTop: 10 }}>
            <span className="wn">Where this fails:</span> this is string matching, not language
            understanding. It cannot tell a delivery drone from a military one except through the
            hand-written negative list. A premise using vocabulary nobody anticipated is refused
            even when a sensible portfolio exists. Replacing this with a language model is the
            single most valuable change that could be made.
          </p>
        </div>
        <div className="cell c3">
          <h3>2. Setting the weights</h3>
          <p className="p" style={{ marginTop: 8 }}>
            Every holding has a conviction score from 0 to 100 measuring how directly it carries the
            theme&rsquo;s claim. Weight is that score raised to the power 2.8, normalised across the
            book. The exponent is what separates a lead position from a filler position — at 1.0 the
            book would be nearly equal weighted; at 2.8 the top name typically holds two to three
            times the smallest.
          </p>
          <p className="p" style={{ marginTop: 10 }}>
            No single name may exceed 27%; the excess is redistributed proportionally. Anything
            under 5% is dropped rather than shown as an unreadable sliver. A ballast sleeve is added
            by risk level: 6% speculative, 10% aggressive, 16% moderate, 22% conservative.
          </p>
        </div>
        <div className="cell c3">
          <h3>3. Where conviction scores come from</h3>
          <p className="p" style={{ marginTop: 8 }}>
            They are editorial judgements, not model output. Each score answers one question: if
            this claim turns out to be true, how directly does this company benefit? A sole supplier
            with no substitute scores in the nineties. A conglomerate with a relevant division
            scores in the sixties. A broad ETF sits in the fifties because it dilutes the claim by
            design.
          </p>
          <p className="p" style={{ marginTop: 10 }}>
            <span className="wn">Where this fails:</span> one person set these numbers and they
            carry that person&rsquo;s blind spots. They are not derived from disclosed revenue and
            nothing here is audited. A production version should tie conviction to segment revenue
            so the score can be checked against a filing.
          </p>
        </div>
        <div className="cell c3">
          <h3>4. Prices, moves and returns</h3>
          <p className="p" style={{ marginTop: 8 }}>
            All of it is synthetic. Prices, market caps, daily moves and sparklines are generated
            deterministically from the ticker string, so they never change and never reflect
            anything real. The track series is drawn from the premise and centred on the index
            drift, meaning roughly half of all books underperform.
          </p>
          <p className="p" style={{ marginTop: 10 }}>
            That centring is deliberate. An earlier build gave the book a higher drift than the
            index, so every book beat the market — a claim the interface was making on its own.
            Nothing on this site should be able to flatter itself.
          </p>
        </div>
        <div className="cell c6">
          <h3>5. What the universe is, and is not</h3>
          <p className="p" style={{ marginTop: 8 }}>
            {NAMES} names across {THEMES.length} themes, last reviewed {REVIEWED}. It is a
            hand-built list chosen to cover claims people actually make about the next decade. It is
            not a screen of every listed security, it holds almost no small caps outside these
            themes, and it is weighted heavily toward US listings. Anything outside it produces a
            refusal rather than a guess.
          </p>
        </div>
      </div>
      <div
        className="hero-cta rv"
        style={{ justifyContent: "flex-start", marginTop: "clamp(30px,4vw,50px)" }}
      >
        <Link className="b1" href="/compose">
          Compose a book
        </Link>
        <Link className="b2" href="/universe">
          See every name
        </Link>
      </div>
    </section>
  );
}
