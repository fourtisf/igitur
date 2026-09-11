/**
 * What the assistant says when it cannot answer.
 *
 * This site has now hidden the same class of failure four times: the compare
 * button, the wallet, the deploy report and /ask. Each time a bare `catch {}`
 * turned a one-line vendor message into hours of guessing, and each time the
 * fix was the same — print what actually happened.
 *
 * So these tests hold the line the route now has to keep: a failed request
 * names its status, a rejected key is distinguishable from a spent quota, and
 * a key never appears in anything a reader or a log can see.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { AddressInfo } from "node:net";

import { describeModelError, readerSentence } from "../lib/model-error";

function vendorError(status: number, type: string, message: string) {
  return Object.assign(new Error(`${status} ${message}`), {
    status,
    error: { type: "error", error: { type, message } },
  });
}

test("a rejected key and a spent quota read differently", () => {
  const auth = readerSentence(describeModelError(vendorError(401, "authentication_error", "invalid x-api-key")));
  const quota = readerSentence(describeModelError(vendorError(429, "rate_limit_error", "slow down")));
  const shape = readerSentence(describeModelError(vendorError(400, "invalid_request_error", "max_tokens: too small")));
  assert.match(auth, /key/);
  assert.match(auth, /401/);
  assert.match(quota, /429/);
  assert.match(shape, /400/);
  assert.notEqual(auth, quota);
  assert.notEqual(quota, shape);
});

test("a key never travels in the message", () => {
  const d = describeModelError(
    vendorError(401, "authentication_error", "invalid key sk-ant-api03-AbCd1234_secret-value")
  );
  assert.ok(!d.message.includes("sk-ant-api03-AbCd1234"), "the key must be redacted");
  assert.match(d.message, /redacted/);
});

test("a failure with no HTTP status still says something", () => {
  const d = describeModelError(Object.assign(new Error("The operation was aborted"), { name: "AbortError" }));
  assert.equal(d.status, null);
  assert.match(readerSentence(d), /AbortError/);
});

test("the route reports the reason rather than swallowing it", () => {
  const route = readFileSync("app/api/ask/route.ts", "utf8");
  assert.ok(!/\}\s*catch\s*\{\s*\n\s*controller/.test(route), "the stream must not swallow its error");
  assert.match(route, /logModelError\("ask", err\)/);
});

/**
 * The whole failure path, end to end, against a vendor that says no.
 *
 * One server for both requests: the client is built once per process and keeps
 * the address it was built with, exactly as it does in production.
 */
let accepts = false;
let hits = 0;
const sent: unknown[] = [];
const vendor = createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    hits += 1;
    if (!accepts) {
      res.writeHead(401, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          type: "error",
          error: { type: "authentication_error", message: "invalid x-api-key" },
        })
      );
      return;
    }
    sent.push(JSON.parse(body || "{}"));
    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        id: "msg_1",
        type: "message",
        role: "assistant",
        model: "claude-opus-5",
        content: [{ type: "text", text: "ok" }],
        stop_reason: "end_turn",
        stop_sequence: null,
        usage: { input_tokens: 1, output_tokens: 1 },
      })
    );
  });
});

test.before(async () => {
  await new Promise<void>((r) => vendor.listen(0, "127.0.0.1", r));
  const { port } = vendor.address() as AddressInfo;
  process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${port}`;
  // The paste that keeps its quote marks is a failure the probe must name.
  process.env.ANTHROPIC_API_KEY = '"sk-ant-test-key"';
});

test.after(() => vendor.close());

test("a rejected key reaches the reader as a rejected key", async () => {
  const { POST } = await import("../app/api/ask/route");
  const res = await POST(
    new Request("http://igitur.test/api/ask", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "10.0.0.1" },
      body: JSON.stringify({ messages: [{ role: "user", content: "what is igitur" }] }),
    })
  );
  const body = await res.text();
  assert.match(body, /401/, "the reader must be told what the service said");
  assert.match(body, /key/, "and that it was about the key");
  assert.ok(!body.includes("sk-ant-test-key"), "never the key itself");
});

/** One request that says whether this deployment's key works at all. */
test("the probe answers without printing the key", async () => {
  const { GET } = await import("../app/api/ask/route");
  const res = await GET(
    new Request("http://igitur.test/api/ask", { headers: { "x-forwarded-for": "10.0.0.2" } })
  );
  const body = (await res.json()) as {
    ok: boolean;
    verdict: string;
    steps: { step: string; ok: boolean; status: number | null; type: string | null }[];
    keyShape: { faults: string[]; length: number };
  };
  assert.equal(body.ok, false);
  assert.equal(body.steps[0].status, 401);
  assert.equal(body.steps[0].type, "authentication_error");
  // A rejected key must not cost a second request that would be rejected too.
  assert.equal(body.steps.length, 1, "the second step is pointless once the key is refused");
  assert.match(body.verdict, /key/i);
  assert.ok(
    body.keyShape.faults.some((f) => /quote/.test(f)),
    "a key pasted with its quotes must be called out"
  );
  assert.ok(!JSON.stringify(body).includes("sk-ant-test-key"), "never the key itself");
});

test("the probe says so plainly when there is no key at all", async () => {
  const had = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  try {
    const { GET } = await import("../app/api/ask/route");
    const res = await GET(new Request("http://igitur.test/api/ask"));
    assert.equal(res.status, 503);
    const body = (await res.json()) as { configured: boolean; note: string };
    assert.equal(body.configured, false);
    assert.match(body.note, /ANTHROPIC_API_KEY/);
  } finally {
    if (had !== undefined) process.env.ANTHROPIC_API_KEY = had;
  }
});

test("a key that is set but refused is not reported as working", async () => {
  // /status called the matcher live for a whole day over a key the service was
  // rejecting, because "configured" was reading .env instead of asking.
  const { modelError, modelIsReal, modelMatcherConfigured } = await import("../lib/matcher/llm");
  assert.equal(modelMatcherConfigured(), true, "a key is set in this process");
  const before = hits;
  assert.equal(await modelIsReal(), false, "set is not the same as accepted");
  assert.match(modelError() ?? "", /401/, "and the reason is kept for the page to print");
  assert.equal(hits, before + 1, "one request, not one per reader");
  await modelIsReal();
  assert.equal(hits, before + 1, "the answer is cached — the failure too");
});

test("the pages ask the service rather than read the configuration", () => {
  for (const f of ["app/status/page.tsx", "app/ask/page.tsx"]) {
    const src = readFileSync(f, "utf8");
    assert.match(src, /await modelIsReal\(\)/, `${f} must ask whether the key works`);
  }
});

/**
 * The accepting case, last: the client is built once per process, so this file
 * runs its failures first and then flips the same server to accepting rather
 * than starting a second one the cached client would never call.
 */
test("when the key is accepted the probe also tests what /ask really sends", async () => {
  accepts = true;
  sent.length = 0;
  const { GET } = await import("../app/api/ask/route");
  const res = await GET(
    new Request("http://igitur.test/api/ask", { headers: { "x-forwarded-for": "10.0.0.3" } })
  );
  const body = (await res.json()) as { ok: boolean; verdict: string; steps: { step: string }[] };
  assert.equal(body.ok, true);
  assert.equal(body.steps.length, 2, "a working key must still prove the real request shape");

  // The second request must be the one /ask makes, not a token of politeness:
  // the whole point is that a shape the service rejects is caught here.
  const real = sent[1] as {
    max_tokens: number;
    output_config?: { effort?: string };
    system?: { text: string }[];
  };
  assert.ok(real.max_tokens >= 2048, "thinking tokens come out of this budget");
  assert.equal(real.output_config?.effort, "low");
  assert.equal(real.system?.length, 2, "rules first, then the corpus that caches");
  assert.match(real.system![1].text, /What Igitur is/);
});
