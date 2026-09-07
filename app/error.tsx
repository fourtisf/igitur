"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * The 500, in the site's own voice.
 *
 * The 404 was given one already; leaving this as the framework default meant a
 * reader hitting a real failure fell out of the product entirely. A site whose
 * headline feature is telling you when it does not know should not go blank
 * when something breaks.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Nothing is sent anywhere — /legal promises no analytics. The digest is
    // what a server log can be matched against.
    console.error("Igitur render error", error.digest ?? error.message);
  }, [error]);

  return (
    <section className="shell pgtop" style={{ paddingBottom: "clamp(50px,7vw,90px)" }}>
      <div className="cell rv in" style={{ padding: "clamp(24px,3.4vw,40px)" }}>
        <span className="badge">
          <b>Error</b> Something failed on our side
        </span>
        <h1 className="pg" style={{ marginTop: 20, maxWidth: "22ch" }}>
          That did not work.
        </h1>
        <p className="sub" style={{ marginTop: 20, fontSize: 15 }}>
          This is a fault here, not in what you wrote. Your premise is still in the address bar, so
          nothing is lost — try again, and if it keeps happening the premise itself is worth sending
          to us.
        </p>
        {error.digest ? (
          <div className="urlbox" style={{ marginTop: 18 }}>
            <code>Reference {error.digest}</code>
          </div>
        ) : null}
        <div style={{ marginTop: 24, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="b1" onClick={reset}>
            Try again
          </button>
          <Link className="b2" href="/compose">
            Compose a book
          </Link>
        </div>
      </div>
    </section>
  );
}
