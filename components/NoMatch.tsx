import Link from "next/link";

import { ThemeCells } from "./ThemeCells";
import { bookHref } from "@/lib/routes";

/**
 * The refusal. HANDOFF.md §0 and §13: this is the product's main
 * differentiator, not an error state. Do not "improve" it into a guess.
 */
export function NoMatch({ premise, emptied }: { premise: string; emptied?: boolean }) {
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
          <Link className="b1" href={bookHref(premise)}>
            {emptied ? "Restore the book" : "Try again"}
          </Link>
          <Link className="b2" href={`/compose?p=${encodeURIComponent(premise)}`}>
            Rewrite the premise
          </Link>
        </div>
      </div>
      <div className="rv" style={{ marginTop: 12 }}>
        <ThemeCells />
      </div>
    </section>
  );
}
