import Link from "next/link";

import { REVIEWED } from "@/lib/universe";
import { SITE } from "@/lib/site";

export function Footer() {
  return (
    <footer className="shell">
      <div className="fg">
        <div>
          <Link className="brand" href="/" style={{ padding: 0 }}>
            <span className="bmark" />
            {SITE.name}
          </Link>
          <p className="p" style={{ marginTop: 12, fontSize: 13, maxWidth: "34ch" }}>
            A working prototype. Research only. Nothing here is investment advice and no order
            ever leaves this page.
          </p>
        </div>
        <div>
          <div className="fh">Product</div>
          <Link href="/compose">Compose</Link>
          <Link href="/history">History</Link>
          <Link href="/trending">Trending</Link>
          <Link href="/track">Track</Link>
        </div>
        <div>
          <div className="fh">Reference</div>
          <Link href="/universe">The universe</Link>
          <Link href="/method">Methodology</Link>
          <Link href="/token">Token</Link>
          <Link href="/status">What is built</Link>
        </div>
        <div>
          <div className="fh">Community</div>
          <a href={SITE.x} target="_blank" rel="noopener">
            X ↗
          </a>
          <a href={SITE.telegram} target="_blank" rel="noopener">
            Telegram ↗
          </a>
          <Link href="/about">About</Link>
          <Link href="/legal">Terms &amp; disclosures</Link>
        </div>
      </div>
      <p className="faint" style={{ fontSize: 12, marginTop: 34 }}>
        © 2026 {SITE.name} · {SITE.build} · Universe reviewed {REVIEWED} · Token not deployed
      </p>
    </footer>
  );
}
