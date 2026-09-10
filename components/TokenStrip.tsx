import Link from "next/link";

import { SITE } from "@/lib/site";

/**
 * The contract address, on every page.
 *
 * /token and the home page both carried this already, but both need scrolling
 * to reach, and the address is the one thing a visitor arriving from a launch
 * post looks for first. Somewhere obvious and always the same place is also the
 * defence: /token promises the address appears here and on X at the same moment
 * and nowhere else first, and a promise like that is only worth something if
 * "here" is a fixed, unmissable spot rather than a paragraph two screens down.
 *
 * It is written to keep working after launch. When
 * `SITE.token.contractAddress` stops being null the strip becomes the canonical
 * place the address lives, rather than a placeholder someone has to remember to
 * replace.
 *
 * ── Why it renders nothing before launch ─────────────────────────────────────
 *
 * All of the above is an argument about the day there IS an address. Before
 * then the strip pins "$IGITUR · Contract address · Coming soon" to the top of
 * every page — the first thing every visitor reads, on a site whose whole
 * problem is that people cannot tell it has a working product. A research tool
 * that opens by advertising an unlaunched token reads as a token that has
 * borrowed a research tool.
 *
 * So it stands down until there is something to point at. Nothing protective is
 * lost: the warning it carries — nothing is tradeable, any address circulating
 * now is fake — is stated at length on /token, on /legal, and in a line on the
 * landing page that links to both. What that warning defends against is someone
 * passing off an address as ours, and the moment that danger becomes real is
 * the moment `contractAddress` stops being null, which is exactly when this
 * comes back. No launch-day checklist item, no forgotten flag.
 *
 * `--strip` is the height the nav and every page's top padding are offset by,
 * so `hasStrip` below keeps the layout honest about whether the space is used.
 */

/** Whether the strip occupies the top of the page. Read by the layout. */
export const hasStrip = SITE.token.contractAddress !== null;

export function TokenStrip() {
  const { ticker, contractAddress } = SITE.token;
  if (!contractAddress) return null;

  return (
    <div className="tstrip">
      <Link className="tstrip-in" href="/token">
        <span className="tst-tag">${ticker}</span>
        {/* "Coming soon" on its own answers nothing. On a narrow screen the
            words go, the meaning does not. */}
        <span className="tst-label">Contract address</span>
        <span className="tst-label-s">CA</span>
        {contractAddress ? (
          <code className="tst-addr">{contractAddress}</code>
        ) : (
          <span className="tst-soon">Coming soon</span>
        )}
        <span className="tst-note">
          {contractAddress
            ? "Verify it here before you trade anything."
            : "Nothing is tradeable yet. Any address circulating now is fake."}
        </span>
      </Link>
    </div>
  );
}
