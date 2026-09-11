"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { SITE } from "@/lib/site";
import { BrandMark, TelegramIcon, XIcon } from "./icons";
import { toast } from "./Toast";

const LINKS: [string, string][] = [
  ["/", "Overview"],
  ["/compose", "Compose"],
  ["/compare", "Compare"],
  ["/history", "History"],
  ["/ledger", "Record"], ["/trending", "Trending"],
  ["/track", "Track"],
  ["/universe", "Universe"],
  ["/token", "Token"],
];

const MENU: [string, string][] = [
  ["/compose", "Compose"],
  ["/compare", "Compare"],
  ["/history", "History"],
  ["/trending", "Trending"],
  ["/track", "Track"],
  ["/universe", "Universe"],
  ["/method", "Method"],
  ["/token", "Token"],
  ["/status", "Status"],
  ["/about", "About"],
  ["/legal", "Terms"],
];

/** Minimal slice of EIP-1193 that this site uses. It reads an address. Nothing else. */
interface Eip1193 {
  request(args: { method: string }): Promise<string[]>;
  on?(event: string, handler: (accounts: string[]) => void): void;
  removeListener?(event: string, handler: (accounts: string[]) => void): void;
  isMetaMask?: boolean;
  /** Present when several wallet extensions are installed and both injected. */
  providers?: Eip1193[];
}

function shortAddr(a: string) {
  return a.slice(0, 6) + "…" + a.slice(-4);
}

/**
 * The wallet to talk to.
 *
 * With two extensions installed, each overwrites `window.ethereum` on load and
 * the winner is whichever ran last — so the button could open a wallet the
 * reader was not expecting, or a provider that answers nothing. Where they
 * cooperate they publish `providers`, and MetaMask is the one to prefer because
 * it is the one whose prompt a reader recognises.
 */
function pickProvider(): Eip1193 | null {
  const eth = (window as { ethereum?: Eip1193 }).ethereum;
  if (!eth) return null;
  if (Array.isArray(eth.providers) && eth.providers.length) {
    return eth.providers.find((p) => p.isMetaMask) ?? eth.providers[0];
  }
  return eth;
}

/**
 * What actually went wrong, in EIP-1193's own numbers.
 *
 * Every failure used to read "Connection rejected", which is true of exactly
 * one of these. The common one is -32002: the wallet's prompt is already open,
 * usually behind the browser window, and nothing has been rejected at all —
 * telling that reader they refused sends them to look in the wrong place.
 */
function explain(err: unknown): string {
  const code = (err as { code?: number })?.code;
  if (code === 4001) return "You declined the connection in your wallet";
  if (code === -32002) return "Your wallet is already asking — check for its window or extension popup";
  if (code === 4900 || code === 4901) return "Your wallet is locked or disconnected. Unlock it and try again";
  const message = (err as { message?: string })?.message;
  return message ? `Wallet error: ${message.slice(0, 90)}` : "Your wallet did not answer";
}

export function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [wallet, setWallet] = useState<string | null>(null);
  /** True while the wallet's own prompt is open. Guards against -32002. */
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    const eth = pickProvider();
    if (!eth) return;

    // Restore a connection the reader already granted. `eth_accounts` returns
    // what is already authorised and never prompts, so this is silent — without
    // it, an already-connected wallet read as disconnected on every page load
    // and the button invited a connection that had already happened.
    eth
      .request({ method: "eth_accounts" })
      .then((acc) => {
        if (acc?.length) setWallet(acc[0]);
      })
      .catch(() => {
        /* A wallet that will not say is simply not connected. */
      });

    if (!eth.on) return;
    const onAccounts = (acc: string[]) => setWallet(acc?.length ? acc[0] : null);
    eth.on("accountsChanged", onAccounts);
    return () => eth.removeListener?.("accountsChanged", onAccounts);
  }, []);

  /**
   * Real EIP-1193 — HANDOFF.md §9. This reads the public address and nothing
   * else. The site never requests a signature, a transaction, a seed phrase or
   * a private key. Keep it that way; /legal promises it.
   */
  async function connect() {
    if (wallet) {
      // A dapp cannot revoke its own permission; this drops the address from
      // the page. Say which one it is, rather than implying the wallet acted.
      setWallet(null);
      toast("Address cleared from this page. Your wallet still lists the site — remove it there to revoke.");
      return;
    }
    // Clicking twice is what produces -32002 in the first place: the second
    // request arrives while the first prompt is still open, and the wallet
    // rejects it rather than the reader.
    if (asking) {
      toast("Already asking — check for your wallet's window or extension popup");
      return;
    }
    const eth = pickProvider();
    if (!eth) {
      toast("No EVM wallet found in this browser. This site only ever reads an address.");
      return;
    }
    setAsking(true);
    try {
      const acc = await eth.request({ method: "eth_requestAccounts" });
      if (acc?.length) {
        setWallet(acc[0]);
        toast("Connected " + shortAddr(acc[0]));
      } else {
        // A wallet that answers with nothing has not refused and has not
        // connected. Saying "rejected" would be a guess.
        toast("Your wallet returned no address. Unlock it and try again.");
      }
    } catch (err) {
      toast(explain(err));
    } finally {
      setAsking(false);
    }
  }

  const isOn = (href: string) =>
    href === "/"
      ? pathname === "/"
      : pathname === href ||
        pathname.startsWith(href + "/") ||
        // A book belongs to Compose in the nav.
        (href === "/compose" && pathname.startsWith("/b/"));

  return (
    <>
      <nav className="nav">
        <div className="navin">
          <Link className="brand" href="/">
            <BrandMark />
            {SITE.name}
          </Link>
          <div className="nlinks" id="nlinks">
            {LINKS.map(([href, label]) => (
              <Link key={href} href={href} className={isOn(href) ? "on" : undefined}>
                {label}
              </Link>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {SITE.x || SITE.telegram ? (
              <div className="soc">
                {SITE.x ? (
                  <a href={SITE.x} target="_blank" rel="noopener" aria-label="X" title="X">
                    <XIcon />
                  </a>
                ) : null}
                {SITE.telegram ? (
                  <a
                    href={SITE.telegram}
                    target="_blank"
                    rel="noopener"
                    aria-label="Telegram"
                    title="Telegram"
                  >
                    <TelegramIcon />
                  </a>
                ) : null}
              </div>
            ) : null}
            <button
              className={"wbtn" + (wallet ? " on" : "")}
              onClick={connect}
              title={wallet ? "Click to disconnect" : "Connect an EVM wallet"}
            >
              <span className="wdot" />
              <span className="wtxt">
                {wallet ? shortAddr(wallet) : asking ? "Check your wallet…" : "Connect wallet"}
              </span>
            </button>
            <button
              className="burger"
              aria-label="Menu"
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
            >
              <span />
            </button>
          </div>
        </div>
      </nav>
      <div className={"mmenu" + (open ? " open" : "")}>
        {MENU.map(([href, label]) => (
          // Closing here rather than in an effect on pathname: the menu is
          // dismissed by the act of navigating, not as a reaction to it.
          <Link key={href} href={href} onClick={() => setOpen(false)}>
            {label}
          </Link>
        ))}
        {SITE.x ? (
          <a href={SITE.x} target="_blank" rel="noopener" onClick={() => setOpen(false)}>
            X ↗
          </a>
        ) : null}
        {SITE.telegram ? (
          <a href={SITE.telegram} target="_blank" rel="noopener" onClick={() => setOpen(false)}>
            Telegram ↗
          </a>
        ) : null}
      </div>
    </>
  );
}
