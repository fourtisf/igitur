import Link from "next/link";

import { ThemeCells } from "./ThemeCells";
import { nearMisses } from "@/lib/nearmiss";
import { bookHref } from "@/lib/routes";
import { UNIVERSE_VERSION } from "@/lib/universe";

/**
 * The refusal. HANDOFF.md §0 and §13: this is the product's main
 * differentiator, not an error state. Do not "improve" it into a guess.
 *
 * What it now does that it did not: rank the way out. The page used to answer
 * "no" with all 26 themes in fixed order, which leaves the reader to find their
 * own near miss by reading the list. `lib/nearmiss.ts` orders them and says why
 * each is close — including, when it happened, the negative keyword that vetoed
 * a theme the premise otherwise matched, which is the single most useful thing
 * this page can say and was previously discarded.
 *
 * Every route out of here still builds a *theme's own written claim*, never the
 * refused premise. The refusal itself is untouched.
 */
export function NoMatch({ premise, emptied }: { premise: string; emptied?: boolean }) {
  // An emptied book is not a vocabulary problem — the premise matched fine and
  // the reader removed every holding. Suggesting other themes would answer a
  // question they did not ask.
  const near = emptied ? [] : nearMisses(premise, 3);

  return (
    <section className="shell pgtop" style={{ paddingBottom: "clamp(50px,7vw,90px)" }}>
      <div className="cell rv" style={{ padding: "clamp(24px,3.4vw,40px)" }}>
        <span className="badge">
          <b>{emptied ? "Empty" : "No match"}</b> Nothing was generated
        </span>
        <h1 className="pg" style={{ marginTop: 20, maxWidth: "22ch" }}>
          {emptied
            ? "You removed every holding."
            : "No theme in this universe carries that claim."}
        </h1>
        <p className="p" style={{ marginTop: 18, fontSize: 13, color: "var(--fg-4)" }}>
          You wrote
        </p>
        <p style={{ marginTop: 6, fontSize: 18, color: "var(--fg-2)", maxWidth: "40ch" }}>
          {premise}
        </p>
        <p className="sub" style={{ marginTop: 20, fontSize: 15 }}>
          {emptied
            ? "Restore the book, or write a different premise."
            : "Rather than assemble something plausible out of whatever was nearest, the tool stops here. Pick a written thesis below, or rewrite the premise naming a specific constraint, industry or resource."}
        </p>
        <div style={{ marginTop: 24, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link className="b1" href={bookHref(premise, [], { universe: UNIVERSE_VERSION })}>
            {emptied ? "Restore the book" : "Try again"}
          </Link>
          <Link className="b2" href={`/compose?p=${encodeURIComponent(premise)}`}>
            Rewrite the premise
          </Link>
        </div>
      </div>

      {near.length ? (
        <div className="rv" style={{ marginTop: "clamp(28px,3.4vw,44px)" }}>
          <h2 style={{ fontSize: 20, maxWidth: "24ch" }}>Closest in this universe</h2>
          <p className="p" style={{ marginTop: 10, fontSize: 13, maxWidth: "62ch" }}>
            These did not match your sentence — nothing did. Each one is here because of something
            the matcher saw on the way to refusing it, and each link builds that theme&rsquo;s own
            written claim, not yours.
          </p>
          <div className="bento" style={{ marginTop: 16 }}>
            {near.map(({ th, reason }) => (
              <div className="cell c2" key={th.id} style={{ padding: 20 }}>
                <h3 style={{ fontSize: 15 }}>{th.name}</h3>
                <p className="p" style={{ fontSize: 12, marginTop: 5 }}>
                  {th.assets.length} names · {th.risk} · {th.horizon}
                </p>
                <div className="sbox" style={{ marginTop: 14, padding: 14 }}>
                  <div className="slab">
                    {reason.kind === "suppressed" ? "Matched, then ruled out" : "Nearly your words"}
                  </div>
                  <div className="stx" style={{ marginTop: 6 }}>
                    {reason.kind === "suppressed" ? (
                      <>
                        Your premise matched{" "}
                        <b className="ac">{reason.hits.slice(0, 3).join(", ")}</b> here, and then{" "}
                        <b className="wn">{reason.term}</b> ruled it out — that term is published as
                        a negative for this theme, so a premise containing it cannot land here.
                      </>
                    ) : (
                      <>
                        Shares vocabulary with your sentence:{" "}
                        <b className="ac">{reason.shared.slice(0, 3).join(", ")}</b>. Close enough
                        for a person to notice, not close enough for the matcher.
                      </>
                    )}
                  </div>
                </div>
                <p
                  className="p"
                  style={{ fontSize: 12.5, marginTop: 12, color: "var(--fg-2)" }}
                >
                  &ldquo;{th.claim}&rdquo;
                </p>
                <Link
                  className="b2"
                  style={{ marginTop: 12, width: "100%", justifyContent: "center" }}
                  href={bookHref(th.claim, [], { universe: UNIVERSE_VERSION })}
                >
                  Build this claim
                </Link>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <p className="p rv" style={{ margin: "clamp(28px,3.4vw,40px) 0 12px", fontSize: 13 }}>
        {near.length ? "Or any of the other written theses" : "Every written thesis in the universe"}
      </p>
      <div className="rv">
        <ThemeCells />
      </div>
    </section>
  );
}
