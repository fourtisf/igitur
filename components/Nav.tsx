"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

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

/** One wallet, as EIP-6963 announces it. */
export interface Discovered {
  uuid: string;
  name: string;
  icon: string;
  provider: Eip1193;
}

interface AnnounceEvent extends Event {
  detail?: { info?: { uuid?: string; name?: string; icon?: string }; provider?: Eip1193 };
}

/**
 * Every wallet in the browser, asked properly.
 *
 * `window.ethereum` is a single slot that every extension overwrites on load,
 * so the winner is whichever ran last. This deployment proved what that costs:
 * the button reached a wallet holding no Ethereum account and returned
 * "Unable to find any account for 60" — 60 being BIP-44's coin type for
 * Ethereum — while MetaMask sat in the same toolbar, unasked.
 *
 * EIP-6963 is the fix the ecosystem settled on: the page asks, and each wallet
 * announces itself with a name and an icon. Nobody overwrites anybody, and when
 * more than one answers the reader chooses instead of the load order choosing
 * for them.
 */
function discover(): Promise<Discovered[]> {
  return new Promise((resolve) => {
    const found = new Map<string, Discovered>();
    const onAnnounce = (e: Event) => {
      const d = (e as AnnounceEvent).detail;
      const uuid = d?.info?.uuid;
      if (!uuid || !d?.provider || found.has(uuid)) return;
      found.set(uuid, {
        uuid,
        name: d.info?.name || "Wallet",
        icon: d.info?.icon || "",
        provider: d.provider,
      });
    };
    window.addEventListener("eip6963:announceProvider", onAnnounce);
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    // Announcements are synchronous in practice; one frame is generous.
    setTimeout(() => {
      window.removeEventListener("eip6963:announceProvider", onAnnounce);
      const list = [...found.values()];
      if (list.length) return resolve(list);
      // Nothing announced: an older extension that only injects the old way.
      const eth = (window as { ethereum?: Eip1193 }).ethereum;
      if (!eth) return resolve([]);
      const legacy = Array.isArray(eth.providers) && eth.providers.length ? eth.providers : [eth];
      resolve(
        legacy.map((p, i) => ({
          uuid: `legacy-${i}`,
          name: p.isMetaMask ? "MetaMask" : "Injected wallet",
          icon: "",
          provider: p,
        }))
      );
    }, 120);
  });
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
  /** True while a wallet's own prompt is open. Guards against -32002. */
  const [asking, setAsking] = useState(false);
  /** The wallets that answered, when more than one did and the reader must pick. */
  const [choices, setChoices] = useState<Discovered[] | null>(null);
  const bound = useRef<Eip1193 | null>(null);

  useEffect(() => {
    let live = true;
    discover().then((found) => {
      if (!live || !found.length) return;
      // Restore a connection already granted, from whichever wallet granted it.
      // `eth_accounts` returns what is already authorised and never prompts, so
      // this is silent — and asking all of them is how a reader who connected
      // with their second wallet is still recognised.
      for (const w of found) {
        w.provider
          .request({ method: "eth_accounts" })
          .then((acc) => {
            if (!live || !acc?.length || bound.current) return;
            bound.current = w.provider;
            setWallet(acc[0]);
            w.provider.on?.("accountsChanged", (a: string[]) =>
              setWallet(a?.length ? a[0] : null)
            );
          })
          .catch(() => {
            /* A wallet that will not say is simply not connected. */
          });
      }
    });
    return () => {
      live = false;
    };
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
      bound.current = null;
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
    const found = await discover();
    if (!found.length) {
      toast("No EVM wallet found in this browser. This site only ever reads an address.");
      return;
    }
    // One wallet is not a choice. Several is, and guessing is what produced
    // "Unable to find any account for 60" — a wallet with no Ethereum account
    // answering because it happened to load last.
    if (found.length > 1) {
      setChoices(found);
      return;
    }
    await ask(found[0]);
  }

  async function ask(w: Discovered) {
    setChoices(null);
    setAsking(true);
    try {
      const acc = await w.provider.request({ method: "eth_requestAccounts" });
      if (acc?.length) {
        bound.current = w.provider;
        setWallet(acc[0]);
        w.provider.on?.("accountsChanged", (a: string[]) => setWallet(a?.length ? a[0] : null));
        toast("Connected " + shortAddr(acc[0]));
      } else {
        // Answering with nothing is neither a refusal nor a connection.
        toast(`${w.name} returned no address. Unlock it and try again.`);
      }
    } catch (err) {
      toast(`${w.name}: ${explain(err)}`);
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
      {/* Shown only when several wallets answered. One wallet is not a choice;
          several is, and letting load order decide is what sent the request to
          a wallet holding no Ethereum account. */}
      {choices ? (
        <div className="wsheet" role="dialog" aria-label="Choose a wallet">
          <div className="wsheet-in">
            <div className="wsheet-head">
              <b>Which wallet?</b>
              <button className="chip" onClick={() => setChoices(null)}>
                Cancel
              </button>
            </div>
            <p className="p" style={{ fontSize: 12.5, margin: "8px 0 14px" }}>
              {choices.length} wallets are installed. Igitur only ever reads an address — it never
              asks for a signature, a transaction or a key.
            </p>
            {choices.map((w) => (
              <button key={w.uuid} className="wopt" onClick={() => ask(w)}>
                {w.icon ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={w.icon} alt="" width={22} height={22} />
                ) : (
                  <span className="wopt-dot" />
                )}
                {w.name}
              </button>
            ))}
          </div>
        </div>
      ) : null}

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
