/**
 * Setting the key, and refusing to set a key that does not work.
 *
 * A wrong key looked exactly like a broken feature: /ask said it could not
 * answer, /compare quietly went back to refusing premises, and /status still
 * reported the model as configured — because "configured" there means a key
 * exists in .env, not that anyone accepted it. The probe now names it, and
 * this script stops it from being installed in the first place.
 *
 * So the script is tested by running it, not by reading it: against a service
 * that rejects the key and a service that accepts it.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, statSync, writeFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AddressInfo } from "node:net";

const GOOD = "sk-ant-api03-goodkey";
const SCRIPT = "scripts/set-key-igitur.sh";

const api = createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const accepted = req.headers["x-api-key"] === GOOD;
    const payload = accepted
      ? {
          id: "m",
          type: "message",
          role: "assistant",
          model: "claude-opus-5",
          content: [{ type: "text", text: "ok" }],
          stop_reason: "end_turn",
          usage: { input_tokens: 1, output_tokens: 1 },
        }
      : { type: "error", error: { type: "authentication_error", message: "API key is invalid." } };
    res.writeHead(accepted ? 200 : 401, { "content-type": "application/json" });
    res.end(JSON.stringify(payload));
  });
});

let base = "";
let home = "";

test.before(async () => {
  await new Promise<void>((r) => api.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(api.address() as AddressInfo).port}`;
});
test.after(() => api.close());

/**
 * Run the script for real.
 *
 * Spawned rather than run synchronously: the service it talks to lives in this
 * same process, and a blocking child would leave nobody to answer it — which
 * is exactly the timeout that made the first version of this test pass for the
 * wrong reason.
 */
async function run(key: string, env: string): Promise<{ code: number; out: string }> {
  home = mkdtempSync(join(tmpdir(), "igitur-key-"));
  writeFileSync(join(home, ".env"), env);
  const child = spawn("bash", [SCRIPT], {
    env: {
      ...process.env,
      APP: home,
      ENV_FILE: join(home, ".env"),
      ANTHROPIC_API_BASE: base,
      SKIP_RELOAD: "1",
    },
  });
  let out = "";
  child.stdout.on("data", (c) => (out += c));
  child.stderr.on("data", (c) => (out += c));
  child.stdin.end(`${key}\n`);
  const code: number = await new Promise((r) => child.on("close", (c) => r(c ?? 0)));
  return { code, out };
}

test("a key the service rejects never reaches .env", async () => {
  const before = "MARKET_PROVIDER=twelvedata\nTWELVEDATA_API_KEY=abc123\n";
  const { code, out } = await run("sk-ant-api03-wrongkey", before);
  assert.notEqual(code, 0, "the script must fail loudly");
  assert.match(out, /401/, "and say what the service said");
  assert.match(out, /API key is invalid/, "in the service's own words");
  // The point of the whole script: the old configuration survives a bad paste.
  assert.equal(readFileSync(join(home, ".env"), "utf8"), before);
});

test("a working key is written, and nothing else in .env is disturbed", async () => {
  const { code, out } = await run(GOOD, "MARKET_PROVIDER=twelvedata\nANTHROPIC_API_KEY=sk-ant-stale\nNO_NEWLINE=yes");
  const env = readFileSync(join(home, ".env"), "utf8");
  assert.match(env, /^MARKET_PROVIDER=twelvedata$/m, "other keys must survive");
  assert.match(env, /^NO_NEWLINE=yes$/m, "a file with no closing newline must not be mangled");
  assert.equal(env.match(/^ANTHROPIC_API_KEY=/gm)?.length, 1, "exactly one key line");
  assert.match(env, new RegExp(`^ANTHROPIC_API_KEY=${GOOD}$`, "m"));
  assert.ok(!env.includes("sk-ant-stale"), "the key it replaces must be gone");
  // A secret is not left world-readable, and never printed.
  assert.equal(statSync(join(home, ".env")).mode & 0o777, 0o600);
  assert.equal(code, 0);
  assert.ok(!out.includes(GOOD), "the key must never appear on screen");
  assert.equal(
    readdirSync(home).filter((f) => f.startsWith(".env.")).length,
    0,
    "no half-written copy of the secret may be left behind"
  );
});

test("a paste that kept its quotes still works", async () => {
  const { code } = await run(`  "${GOOD}"  `, "");
  assert.equal(code, 0);
  assert.match(readFileSync(join(home, ".env"), "utf8"), new RegExp(`^ANTHROPIC_API_KEY=${GOOD}$`, "m"));
});

test("it shows the installed key the way the console shows it", async () => {
  // The console only ever shows sk-ant-api03-AeO...SQAA. Printing the same
  // shape here answers the question that actually blocks the operator: is the
  // key on this server the same one, mistyped in the middle, or a different
  // key altogether.
  const installed = `sk-ant-api03-AeO${"x".repeat(24)}SQAA`;
  const { out } = await run("sk-ant-api03-wrongkey", `ANTHROPIC_API_KEY=${installed}\n`);
  assert.match(out, /sk-ant-api03-AeO\.\.\.SQAA/, "masked like the console masks it");
  assert.ok(!out.includes(installed), "never the whole key");
});

test("typing it in the open is possible, but never the default", () => {
  // A key that must be retyped from a photograph cannot be typed blind; a key
  // that was never in a photograph should never be on screen. So: opt-in.
  const src = readFileSync(SCRIPT, "utf8");
  assert.match(src, /SHOW_KEY:-/, "there must be a way to see what is typed");
  const hidden = src.indexOf("read -rs RAW");
  const shown = src.indexOf("read -r RAW");
  assert.ok(hidden > -1 && shown > -1, "both paths must exist");
  assert.match(src, /SHOW_KEY.*\}" = "1" \] && \[ -t 0 \]/, "the visible path is asked for, not stumbled into");
});

test("the key travels by stdin, never as an argument", () => {
  // Anything on a command line is readable by every user on the box.
  const src = readFileSync(SCRIPT, "utf8");
  assert.match(src, /read -rs RAW/, "it must be read without echo");
  assert.match(src, /curl -sS --config -/, "and handed to curl on stdin");
  assert.ok(!/-H ["']x-api-key/.test(src), "never as a -H argument");
});
