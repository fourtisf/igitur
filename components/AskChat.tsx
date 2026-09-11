"use client";

import { useEffect, useRef, useState } from "react";

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

const OPENERS = [
  "How are the weights decided?",
  "Where do the conviction scores come from?",
  "Why did it refuse my sentence?",
  "What is not built yet?",
];

export function AskChat() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const field = useRef<HTMLTextAreaElement>(null);
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

  return (
    <div className="ask rv">
      {turns.length ? (
        <div className="ask-log">
          {turns.map((t, i) => (
            <div key={i} className={"ask-turn " + t.role}>
              <span className="ask-who">{t.role === "user" ? "You" : "Igitur"}</span>
              <div className="ask-text">
                {t.content || <span className="ask-wait">thinking…</span>}
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

      {/* Where somebody about to ask what to buy will read it first. */}
      <p className="notice warn rv" style={{ marginTop: 16 }}>
        This will not tell you what to buy. It cannot: it does not know your position, your
        horizon or your circumstances, and it has no price data at all. It explains what this
        site holds and why — nothing here is investment advice.
      </p>
    </div>
  );
}
