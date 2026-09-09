/**
 * The transport itself, against a real TLS server on localhost.
 *
 * This layer replaced `fetch` because Next's patched fetch cached a vendor's
 * 403 for an hour and served generated prices behind it. Replacing a tested
 * thing with an untested one would have been the same mistake in a new place,
 * so these run the actual sockets: redirects, cookies, compression, timeouts
 * and the size cap.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { execFileSync } from "node:child_process";
import type { ServerResponse } from "node:http";
import { createServer, type Server } from "node:https";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

import { cookieHeader, httpGet } from "../lib/market/http";

// A self-signed certificate is untrusted by definition; this process is a test
// harness talking to itself on the loopback interface, and nothing else.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const dir = mkdtempSync(join(tmpdir(), "igitur-tls-"));
execFileSync("openssl", [
  "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1",
  "-subj", "/CN=localhost",
  "-keyout", join(dir, "k.pem"), "-out", join(dir, "c.pem"),
]);
const tls = { key: readFileSync(join(dir, "k.pem")), cert: readFileSync(join(dir, "c.pem")) };

type Handler = (url: string, res: ServerResponse) => void;

async function withServer(handler: Handler, run: (base: string) => Promise<void>) {
  const server: Server = createServer(tls, (req, res) => handler(req.url ?? "/", res));
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const { port } = server.address() as { port: number };
  try {
    await run(`https://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
  }
}

test("a plain 200 comes back with its body", async () => {
  await withServer(
    (_u, res) => res.end("hello"),
    async (base) => {
      const r = await httpGet(`${base}/x`);
      assert.equal(r.status, 200);
      assert.equal(r.body, "hello");
      assert.equal(r.error, null);
    }
  );
});

test("a gzipped body is decompressed, not handed on as bytes", async () => {
  // The request advertises gzip to look like a browser, which means it has to
  // be able to read one back. Skipping this would feed the JSON parser binary.
  await withServer(
    (_u, res) => {
      res.setHeader("Content-Encoding", "gzip");
      res.end(gzipSync(Buffer.from(JSON.stringify({ ok: true }))));
    },
    async (base) => {
      assert.deepEqual(JSON.parse((await httpGet(base)).body), { ok: true });
    }
  );
});

test("a redirect is followed, and the cookie it set on the way is kept", async () => {
  // Yahoo's session starts with a redirect that carries the cookie. Dropping
  // cookies from a redirect hop means never earning a crumb, which looks
  // exactly like the endpoint refusing us.
  await withServer(
    (url, res) => {
      if (url === "/start") {
        res.setHeader("Set-Cookie", "A1=d=abc; Path=/; HttpOnly");
        res.writeHead(302, { Location: "/end" });
        res.end();
        return;
      }
      res.setHeader("Set-Cookie", "A3=xyz; Path=/");
      res.end("arrived");
    },
    async (base) => {
      const r = await httpGet(`${base}/start`);
      assert.equal(r.status, 200);
      assert.equal(r.body, "arrived");
      assert.equal(cookieHeader(r.cookies), "A1=d=abc; A3=xyz");
    }
  );
});

test("a redirect loop stops instead of spinning", async () => {
  let hops = 0;
  await withServer(
    (_u, res) => {
      hops++;
      res.writeHead(302, { Location: "/again" });
      res.end();
    },
    async (base) => {
      const r = await httpGet(base);
      assert.ok(hops <= 6, `followed ${hops} hops`);
      assert.equal(r.status, 302, "the last hop is reported rather than followed for ever");
    }
  );
});

test("a server that never answers times out and says so", async () => {
  await withServer(
    () => {
      /* deliberately never responds */
    },
    async (base) => {
      const r = await httpGet(base, { timeoutMs: 250 });
      assert.equal(r.status, 0);
      assert.equal(r.error, "timeout");
    }
  );
});

test("a request that cannot connect is an answer, not an exception", async () => {
  // Every caller's response to a dead vendor is the same, so this must not be
  // something a page render has to catch.
  const r = await httpGet("https://127.0.0.1:1/nothing", { timeoutMs: 500 });
  assert.equal(r.status, 0);
  assert.ok(r.error);
});

test("a non-https URL is refused rather than downgraded", async () => {
  const r = await httpGet("http://127.0.0.1:1/x");
  assert.equal(r.error, "not https");
});

test("headers and a cookie are sent as given", async () => {
  let seen: Record<string, unknown> = {};
  const server = createServer(tls, (req, res) => {
    seen = req.headers as Record<string, unknown>;
    res.end("ok");
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const { port } = server.address() as { port: number };
  await httpGet(`https://127.0.0.1:${port}/`, {
    headers: { "User-Agent": "test-agent" },
    cookie: "A1=d=abc",
  });
  await new Promise<void>((r) => server.close(() => r()));

  assert.equal(seen["user-agent"], "test-agent", "Yahoo answers a bare request with 403");
  assert.equal(seen.cookie, "A1=d=abc");
  assert.match(String(seen["accept-encoding"]), /gzip/);
});
