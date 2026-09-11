import Anthropic from "@anthropic-ai/sdk";

import { corpus, RULES } from "@/lib/ask/corpus";
import { modelMatcherConfigured } from "@/lib/matcher/llm";

/**
 * The assistant behind /ask.
 *
 * It answers from lib/ask/corpus.ts and nothing else — no tools, no search, no
 * memory of anyone. The rules in RULES are the point of the endpoint rather
 * than decoration: a free-text assistant on a site about portfolios is the
 * quickest way to lose the position everything here rests on, which is that
 * this is research and never advice.
 *
 * Streamed, because a nine-thousand-token prompt takes a moment and a reader
 * watching nothing happen assumes it is broken.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Per address, per window. A conversation, not a scraping budget. */
const LIMIT = 30;
const WINDOW_MS = 60 * 60 * 1000;

/** One question. Longer than this is not a question. */
const MAX_CHARS = 1000;
/** How much of the conversation travels back. Enough to follow up, not a novel. */
const MAX_TURNS = 8;

const seen = new Map<string, number[]>();

function tooMany(ip: string): boolean {
  const now = Date.now();
  const hits = (seen.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  hits.push(now);
  seen.set(ip, hits);
  if (seen.size > 5000) {
    for (const [k, v] of seen) {
      if (!v.some((t) => now - t < WINDOW_MS)) seen.delete(k);
    }
  }
  return hits.length > LIMIT;
}

interface Turn {
  role: "user" | "assistant";
  content: string;
}

function clean(raw: unknown): Turn[] {
  if (!Array.isArray(raw)) return [];
  const out: Turn[] = [];
  for (const t of raw.slice(-MAX_TURNS)) {
    const role = (t as Turn)?.role;
    const content = (t as Turn)?.content;
    if (role !== "user" && role !== "assistant") continue;
    if (typeof content !== "string" || !content.trim()) continue;
    out.push({ role, content: content.slice(0, MAX_CHARS) });
  }
  // The API requires the first turn to be the reader's.
  while (out.length && out[0].role !== "user") out.shift();
  return out;
}

let client: Anthropic | null = null;

export async function POST(req: Request) {
  if (!modelMatcherConfigured()) {
    return Response.json(
      { error: "The assistant is not configured on this deployment. Everything it would answer from is on /universe, /method and /status." },
      { status: 503 }
    );
  }

  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  if (tooMany(ip)) {
    return Response.json(
      { error: "That is a lot of questions for one hour. Try again later, or read /method — it says more than I can." },
      { status: 429 }
    );
  }

  let turns: Turn[] = [];
  try {
    const body = (await req.json()) as { messages?: unknown };
    turns = clean(body.messages);
  } catch {
    return Response.json({ error: "Send JSON with messages." }, { status: 400 });
  }
  if (!turns.length) return Response.json({ error: "Nothing to answer." }, { status: 400 });

  client ??= new Anthropic();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enc = new TextEncoder();
      try {
        const s = client!.messages.stream({
          model: "claude-opus-5",
          max_tokens: 1024,
          // Short factual answers from a fixed corpus. Effort low is the
          // documented setting for this shape of work.
          output_config: { effort: "low" },
          system: [
            // The rules and the corpus never change between requests, so they
            // cache: the volatile part is the question, and it goes last.
            { type: "text", text: RULES },
            { type: "text", text: corpus(), cache_control: { type: "ephemeral" } },
          ],
          messages: turns,
        });
        for await (const event of s) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta" &&
            event.delta.text
          ) {
            controller.enqueue(enc.encode(event.delta.text));
          }
        }
        const final = await s.finalMessage();
        // A model that declines is not an error, and the reader is owed the
        // reason rather than an empty box.
        if (final.stop_reason === "refusal") {
          controller.enqueue(enc.encode("\n\nI cannot answer that one."));
        }
      } catch {
        controller.enqueue(
          enc.encode("The assistant could not answer just now. Everything it works from is on /universe, /method and /status.")
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
      "x-accel-buffering": "no",
    },
  });
}
