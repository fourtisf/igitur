"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

/**
 * The assistant, as a page rather than a bubble in the corner.
 *
 * A floating widget on every page would be the fourth thing competing with the
 * one action this site has. This is its own address, linked from the pages
 * whose answers it repeats, and a reader who never opens it loses nothing.
 *
 * The disclosure above the field is not boilerplate. It is the same sentence
 * /legal makes, put where somebody about to type "should I buy NVDA" will read
 * it before they type it.
 */
interface Turn {
  role: "user" | "assistant";
  content: string;
}

interface Thesis {
  id: string;
  name: string;
  claim: string;
}

interface Props {
  /** Every ticker in the universe, so an answer that names one can link to it. */
  tickers: string[];
  themes: Thesis[];
}

/**
 * The four openers are a template, not decoration. Left to themselves readers
 * type "should I buy NVDA", get the one answer the site will never give, and
 * leave — so the chips show the shape of question this thing answers properly:
 * a name, a thesis, the mechanism, and the limits.
 */
const OPENERS = [
  "Why is NVDA in Igitur at all?",
  "What has to stay true for the compute buildout thesis to work?",
  "What horizon and risk band is each thesis written for?",
  "How is a weight decided, and by whom?",
];

export function AskChat({ tickers, themes }: Props) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const field = useRef<HTMLTextAreaElement>(null);
  /* One pass over the answer, not 164. Built once, reused for every turn. */
  const named = useMemo(() => new RegExp(`\\b(${tickers.join("|")})\\b`, "g"), [tickers]);
  const foot = useRef<HTMLDivElement>(null);

  useEffect(() => {
    foot.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    setValue("");
    const next: Turn[] = [...turns, { role: "user", content: q }];
    setTurns([...next, { role: "assistant", content: "" }]);
    setBusy(true);

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });

      if (!res.ok || !res.body) {
        const why = await res.json().catch(() => null);
        setTurns([
          ...next,
          { role: "assistant", content: why?.error ?? "The assistant could not answer just now." },
        ]);
        return;
      }

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value: chunk } = await reader.read();
        if (done) break;
        acc += dec.decode(chunk, { stream: true });
        setTurns([...next, { role: "assistant", content: acc }]);
      }
    } catch {
      setTurns([
        ...next,
        { role: "assistant", content: "The connection dropped before the answer arrived." },
      ]);
    } finally {
      setBusy(false);
      field.current?.focus();
    }
  }

  /**
   * What the reader can do with the answer they just got.
   *
   * This is the part that stops a refusal being a dead end. The assistant is
   * not allowed to recommend anything and should not be — but "I will not tell
   * you whether to buy NVDA" is only useful if the next thing on screen is
   * NVDA's own page, the score behind it and a portfolio built from the thesis
   * it belongs to. The model writes the prose; this decides where the site's
   * pages are, so every link here is real by construction.
   */
  function acts(text: string) {
    const names: string[] = [];
    for (const m of text.matchAll(named)) {
      if (!names.includes(m[1])) names.push(m[1]);
      if (names.length >= 3) break;
    }
    const low = text.toLowerCase();
    const thesis = themes.find((t) => low.includes(t.name.toLowerCase()));
    return { names, thesis };
  }

  return (
    <div className="ask rv">
      {turns.length ? (
        <div className="ask-log">
          {turns.map((t, i) => (
            <div key={i} className={"ask-turn " + t.role}>
              <span className="ask-who">{t.role === "user" ? "You" : "Igitur"}</span>
              <div className="ask-text">
                {t.content || <span className="ask-wait">thinking…</span>}
                {t.role === "assistant" && t.content && !(busy && i === turns.length - 1)
                  ? (() => {
                      const { names, thesis } = acts(t.content);
                      if (!names.length && !thesis) return null;
                      return (
                        <div className="ask-acts">
                          {names.map((n) => (
                            <Link key={n} className="chip" href={`/name/${n.toLowerCase()}`}>
                              {n} in full
                            </Link>
                          ))}
                          {thesis ? (
                            <Link
                              className="chip"
                              href={`/compose?p=${encodeURIComponent(thesis.claim)}`}
                            >
                              Build the {thesis.name.toLowerCase()} portfolio
                            </Link>
                          ) : null}
                        </div>
                      );
                    })()
                  : null}
              </div>
            </div>
          ))}
          <div ref={foot} />
        </div>
      ) : (
        <div className="ask-openers">
          <p className="p" style={{ fontSize: 13, marginBottom: 12 }}>
            It answers from the published theses, the conviction scores and the methodology —
            and says so when it does not know. Try one:
          </p>
          {OPENERS.map((o) => (
            <button key={o} className="chip" onClick={() => send(o)}>
              {o}
            </button>
          ))}
        </div>
      )}

      <div className="composer" style={{ marginTop: 18 }}>
        <div className="cfield">
          <textarea
            className="cin"
            ref={field}
            rows={1}
            value={value}
            placeholder="Ask about a thesis, a weight, or how any of it works"
            aria-label="Your question"
            style={{ fontSize: 16 }}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(value);
              }
            }}
          />
        </div>
        <div className="crow2">
          <button className="b1" onClick={() => send(value)} disabled={busy}>
            {busy ? "Answering…" : "Ask"}
          </button>
          {turns.length ? (
            <button className="chip" onClick={() => setTurns([])} disabled={busy}>
              Start over
            </button>
          ) : null}
          <span className="faint" style={{ fontSize: 12 }}>
            Enter to ask · Shift+Enter for a new line
          </span>
        </div>
      </div>

      {/* One line, not a paragraph.
          The block that stood here said the same thing at four times the
          length and in a warning colour, directly under a chat box — the first
          thing a reader saw was a wall of what the product would not do. It is
          still said, because /legal says it and a page that quotes live prices
          must not be the one page that stops saying it. It is just said once,
          quietly, where a footnote belongs. */}
      <p className="faint" style={{ fontSize: 12, marginTop: 14, lineHeight: 1.6 }}>
        Research, not advice — it explains what this site holds and why, and does not know your
        circumstances.{" "}
        <Link href="/legal" style={{ color: "inherit", textDecoration: "underline" }}>
          Terms
        </Link>
      </p>
    </div>
  );
}
