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
 */
export function TokenStrip() {
  const { ticker, contractAddress } = SITE.token;

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
