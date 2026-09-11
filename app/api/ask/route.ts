import Anthropic from "@anthropic-ai/sdk";

import { corpus, RULES } from "@/lib/ask/corpus";
import { MODEL, modelMatcherConfigured } from "@/lib/matcher/llm";
import { logModelError, readerSentence } from "@/lib/model-error";

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
 *
 * GET is a probe, in the same spirit as /api/market-probe: when the assistant
 * will not answer, one request says whether the key is missing, malformed or
 * rejected, so this is diagnosed from the site rather than from the server.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Per address, per window. A conversation, not a scraping budget. */
const LIMIT = 30;
/** The probe costs a request of its own, so it gets a much smaller allowance. */
const PROBE_LIMIT = 6;
const WINDOW_MS = 60 * 60 * 1000;

/** One question. Longer than this is not a question. */
const MAX_CHARS = 1000;
/** How much of the conversation travels back. Enough to follow up, not a novel. */
const MAX_TURNS = 8;
/**
 * Thinking is on by default on this model, and its tokens are drawn from this
 * budget. Too small a ceiling truncates the answer after the reasoning, which
 * reads to a reader as the assistant stopping mid-sentence.
 */
const MAX_TOKENS = 2048;

const seen = new Map<string, number[]>();
const probed = new Map<string, number[]>();

function tooMany(store: Map<string, number[]>, ip: string, limit: number): boolean {
  const now = Date.now();
  const hits = (store.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  hits.push(now);
  store.set(ip, hits);
  if (store.size > 5000) {
    for (const [k, v] of store) {
      if (!v.some((t) => now - t < WINDOW_MS)) store.delete(k);
    }
  }
  return hits.length > limit;
}

function address(req: Request): string {
  return (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
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

  if (tooMany(seen, address(req), LIMIT)) {
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
          model: MODEL,
          max_tokens: MAX_TOKENS,
          // Low was right when the job was a lookup. The job is now synthesis:
          // hold a thesis, its case for, a name's score and the counter-case in
          // mind at once, and write them as one argument rather than four
          // quotations. That is worth the extra seconds.
          output_config: { effort: "medium" },
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
      } catch (err) {
        // Never swallow this. A silent failure here cost a day of guessing:
        // the page said "could not answer just now" whether the key was wrong,
        // the quota was spent or the request was malformed, and those need
        // three different fixes.
        controller.enqueue(enc.encode(readerSentence(logModelError("ask", err))));
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

/**
 * Does this deployment's key work — and if not, why not.
 *
 * Two steps, in order, because they fail for different reasons and need
 * different fixes:
 *
 *   1. the smallest possible request — no corpus, no system prompt, no output
 *      config. If this fails the key or the network is wrong.
 *   2. exactly what /ask sends, corpus and all. If step 1 passed and this
 *      fails, the key is fine and the request shape is what the service is
 *      rejecting — and its message names the field.
 *
 * One request from a phone tells the whole story, which is the point: this was
 * diagnosed for an hour from a sentence that said only "could not answer".
 * The key itself never appears in the answer; its shape does, because every
 * wrong key this project has had was a paste that kept a quote or lost a
 * character.
 */
interface Step {
  step: string;
  ok: boolean;
  ms: number;
  status?: number | null;
  type?: string | null;
  message?: string;
}

async function attempt(step: string, run: () => Promise<unknown>): Promise<Step> {
  const started = Date.now();
  try {
    await run();
    return { step, ok: true, ms: Date.now() - started };
  } catch (err) {
    const d = logModelError(`ask-probe:${step}`, err);
    return { step, ok: false, ms: Date.now() - started, status: d.status, type: d.type, message: d.message };
  }
}

export async function GET(req: Request) {
  const raw = process.env.ANTHROPIC_API_KEY ?? "";
  const key = raw.trim();
  if (!key) {
    return Response.json(
      { configured: false, note: "ANTHROPIC_API_KEY is not set in the running process." },
      { status: 503, headers: { "cache-control": "no-store" } }
    );
  }

  if (tooMany(probed, address(req), PROBE_LIMIT)) {
    return Response.json({ error: "Probed too often. Try again later." }, { status: 429 });
  }

  // What is wrong with a pasted key, without printing the key.
  const faults: string[] = [];
  if (raw !== key) faults.push("surrounding whitespace");
  if (/^['"]|['"]$/.test(key)) faults.push("quote marks kept from the paste");
  if (!key.startsWith("sk-ant-")) faults.push("does not start with sk-ant-");
  if (/\s/.test(key)) faults.push("contains a space or line break");

  const api = (client ??= new Anthropic());

  const steps: Step[] = [];
  steps.push(
    await attempt("minimal", () =>
      api.messages.create({
        model: MODEL,
        max_tokens: 16,
        messages: [{ role: "user", content: "Reply with the single word: ok" }],
      })
    )
  );
  // Only worth sending if the key was accepted — a second rejection says the
  // same thing at the price of another request.
  if (steps[0].ok) {
    steps.push(
      await attempt("as /ask sends it", () =>
        api.messages.create({
          model: MODEL,
          max_tokens: MAX_TOKENS,
          output_config: { effort: "low" },
          system: [
            { type: "text", text: RULES },
            { type: "text", text: corpus(), cache_control: { type: "ephemeral" } },
          ],
          messages: [{ role: "user", content: "What is Igitur?" }],
        })
      )
    );
  }

  const bad = steps.find((s) => !s.ok);
  const verdict = !bad
    ? "The assistant is working. If /ask still fails, the deployment serving it is older than this one."
    : bad.step === "minimal"
      ? bad.status === 401 || bad.status === 403
        ? "The key in this deployment is not accepted. Re-set ANTHROPIC_API_KEY and reload the process."
        : bad.status === 429
          ? "The key works but the account is rate limited or out of credit."
          : `The request to the model service did not complete: ${bad.type ?? "no reason given"}.`
      : "The key works. What /ask itself sends is being rejected — the message below names the field.";

  return Response.json(
    {
      configured: true,
      keyShape: { length: key.length, prefix: key.slice(0, 11), faults },
      ok: !bad,
      steps,
      verdict,
    },
    { headers: { "cache-control": "no-store" } }
  );
}
