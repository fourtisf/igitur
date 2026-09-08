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
  ["/trending", "Trending"],
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
}

function shortAddr(a: string) {
  return a.slice(0, 6) + "…" + a.slice(-4);
}

export function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [wallet, setWallet] = useState<string | null>(null);

  useEffect(() => {
    const eth = (window as { ethereum?: Eip1193 }).ethereum;
    if (!eth?.on) return;
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
      setWallet(null);
      toast("Wallet disconnected");
      return;
    }
    const eth = (window as { ethereum?: Eip1193 }).ethereum;
    if (!eth) {
      toast("No EVM wallet detected in this browser");
      return;
    }
    try {
      const acc = await eth.request({ method: "eth_requestAccounts" });
      if (acc?.length) {
        setWallet(acc[0]);
        toast("Connected " + shortAddr(acc[0]));
      }
    } catch {
      toast("Connection rejected");
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
              <span className="wtxt">{wallet ? shortAddr(wallet) : "Connect wallet"}</span>
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
