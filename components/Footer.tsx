import Link from "next/link";

import { BrandMark } from "./icons";

import { REVIEWED, UNIVERSE_VERSION } from "@/lib/universe";
import { SITE } from "@/lib/site";

export function Footer() {
  return (
    <footer className="shell">
      <div className="fg">
        <div>
          <Link className="brand" href="/" style={{ padding: 0 }}>
            <BrandMark />
            {SITE.name}
          </Link>
          <p className="p" style={{ marginTop: 12, fontSize: 13, maxWidth: "34ch" }}>
            Research output only. Nothing here is investment advice and no order ever leaves this
            page.
          </p>
        </div>
        <div>
          <div className="fh">Product</div>
          <Link href="/compose">Compose</Link>
          <Link href="/ask">Ask</Link>
          <Link href="/compare">Compare</Link>
          <Link href="/history">History</Link>
          <Link href="/trending">Trending</Link>
          <Link href="/track">Track</Link>
        </div>
        <div>
          <div className="fh">Reference</div>
          <Link href="/universe">The universe</Link>
          <Link href="/changes">Universe changes</Link>
          <Link href="/method">Methodology</Link>
          <Link href="/ledger">The record</Link>
          <Link href="/token">Token</Link>
          <Link href="/status">What is built</Link>
        </div>
        <div>
          <div className="fh">Community</div>
          {SITE.x ? (
            <a href={SITE.x} target="_blank" rel="noopener">
              X ↗
            </a>
          ) : null}
          {SITE.telegram ? (
            <a href={SITE.telegram} target="_blank" rel="noopener">
              Telegram ↗
            </a>
          ) : null}
          <Link href="/about">About</Link>
          <Link href="/legal">Terms &amp; disclosures</Link>
        </div>
      </div>
      <p className="faint" style={{ fontSize: 12, marginTop: 34 }}>
        {/* "Prototype build 2.1" used to sit here, on every page. /about and
            /status both say what stage this is at, at length and with the
            detail that makes it useful; a bare word in the footer of a working
            site only tells a first-time reader not to trust what they are
            looking at. The two disclosures that do carry information — what
            data version they are reading, and that the token does not exist —
            stay. */}
        © 2026 {SITE.name} · Universe v{UNIVERSE_VERSION}, reviewed {REVIEWED} · Research only ·{" "}
        {SITE.token.contractAddress
          ? `$${SITE.token.ticker} contract published on /token — no other address is ours`
          : "Token not deployed"}
      </p>
    </footer>
  );
}
