import type { Metadata } from "next";
import Link from "next/link";

import { pageOg } from "@/lib/og-pages";
import { SITE } from "@/lib/site";
import { CHANGELOG, NAMES, REVIEWED, THEMES, UNIVERSE_VERSION } from "@/lib/universe";

export const metadata: Metadata = {
  title: "Universe changes",
  description:
    "Every revision to the published universe, versioned. A book is deterministic for a given universe, so each version is recorded and every book says which one it was built against.",
  alternates: { canonical: "/changes" },
  openGraph: {
    url: "/changes",
    title: `Universe changes — ${SITE.name}`,
    description: "Every revision to the published universe, versioned and dated.",
    images: [{ url: pageOg("universe"), width: 1200, height: 630 }],
  },
  twitter: { card: "summary_large_image", images: [pageOg("universe")] },
};

/**
 * The companion to universe versioning.
 *
 * Publishing the universe is only half of the promise; publishing what changed
 * in it is the other half. Without this page a reader holding an older link is
 * told their book may have moved but has no way to find out how.
 */
export default function ChangesPage() {
  return (
    <section className="shell pgtop" style={{ paddingBottom: "clamp(50px,7vw,90px)" }}>
      <span className="kick rv">Changes</span>
      <h1 className="pg rv" style={{ marginTop: 12, maxWidth: "18ch" }}>
        What changed in the universe, and when.
      </h1>
      <p className="sub rv" style={{ marginTop: 16 }}>
        A book is deterministic for a given universe, not for all time. Move one conviction score
        and every book touching that theme reweights. So the universe is versioned, every book URL
        records the version it was built against, and a book built on an older one says so instead
        of quietly showing you something else.
      </p>

      <div className="stats rv" style={{ marginTop: "clamp(26px,3.5vw,44px)" }}>
        <div>
          <div className="sn">v{UNIVERSE_VERSION}</div>
          <div className="sl">current version</div>
        </div>
        <div>
          <div className="sn">{CHANGELOG.length}</div>
          <div className="sl">published revisions</div>
        </div>
        <div>
          <div className="sn">{NAMES}</div>
          <div className="sl">names</div>
        </div>
        <div>
          <div className="sn" style={{ fontSize: 18, letterSpacing: "-.02em", paddingTop: 7 }}>
            {REVIEWED}
          </div>
          <div className="sl">last reviewed</div>
        </div>
      </div>

      {CHANGELOG.map((rel) => (
        <div className="cell rv" key={rel.version} style={{ marginTop: 12, padding: "clamp(20px,2.6vw,28px)" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              gap: 14,
              flexWrap: "wrap",
            }}
          >
            <h3>
              Universe v{rel.version}
              {rel.version === UNIVERSE_VERSION ? (
                <span className="pill pon" style={{ marginLeft: 10 }}>
                  Current
                </span>
              ) : null}
            </h3>
            <span className="faint" style={{ fontSize: 12.5 }}>
              {rel.date}
            </span>
          </div>
          <p className="p" style={{ marginTop: 10, maxWidth: "68ch" }}>
            {rel.summary}
          </p>
          {rel.changes.length ? (
            <div style={{ marginTop: 14 }}>
              {rel.changes.map((c) => (
                <div className="kv" key={c}>
                  <span className="kv-k">{c}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ))}

      <p className="notice rv" style={{ marginTop: 26 }}>
        Older books are flagged, not preserved. Rebuilding a book against the universe it was
        written on would mean keeping every past version, and that is not built — which is why the
        notice says the holdings may have moved rather than claiming to restore them.
      </p>

      <div
        className="hero-cta rv"
        style={{ justifyContent: "flex-start", marginTop: "clamp(30px,4vw,50px)" }}
      >
        <Link className="b1" href="/universe">
          See the universe
        </Link>
        <Link className="b2" href="/method">
          How the weights were set
        </Link>
      </div>
      <p className="faint rv" style={{ marginTop: 20, fontSize: 12 }}>
        {THEMES.length} themes are published in full on the universe page.
      </p>
    </section>
  );
}
