import { request as httpsRequest } from "node:https";
import { brotliDecompressSync, gunzipSync, inflateSync } from "node:zlib";

/**
 * A plain HTTPS GET, deliberately not `fetch`.
 *
 * ── Why not fetch ────────────────────────────────────────────────────────────
 *
 * Next patches the global fetch and routes it through its Data Cache, and that
 * cache is the reason this site served generated prices for an hour at a time
 * from a vendor that was answering perfectly well:
 *
 *  1. A cached entry is keyed on the URL and stored regardless of status. One
 *     403 during `next build` — when 163 tickers leave at once and any vendor
 *     with sense throttles the burst — is then replayed for the whole hour of
 *     its revalidate window. The site could not recover until the next deploy,
 *     and a deploy would earn a fresh 403 the same way. That is exactly what
 *     was seen in production: `curl` from the same server returned real JSON
 *     while the app insisted the source was not answering.
 *  2. The escape hatch, `cache: "no-store"`, throws DynamicServerError inside a
 *     statically rendered route, which is a worse bug than the one it fixes.
 *  3. Set-Cookie does not reliably survive the cache, and Yahoo's batch quote
 *     endpoint needs a cookie and a crumb.
 *
 * So vendor traffic leaves through node:https and is cached once, in-process,
 * by ./index.ts — one layer that knows the vendor's allowance instead of two
 * that disagree.
 *
 * Never rejects: a failure is a status of 0 and an `error` string, because
 * every caller's answer to a dead vendor is the same and it is not an
 * exception.
 */

/** A vendor call that hangs must not hold a page render open. */
const DEFAULT_TIMEOUT_MS = 8_000;

/** A vendor answering with something enormous is a vendor to walk away from. */
const MAX_BYTES = 8 * 1024 * 1024;

const MAX_REDIRECTS = 4;

export interface HttpResponse {
  /** 0 when the request never completed. */
  status: number;
  body: string;
  /** Raw Set-Cookie lines, for the endpoints that need a session. */
  cookies: string[];
  error: string | null;
}

export interface HttpOptions {
  headers?: Record<string, string>;
  timeoutMs?: number;
  /** Sent verbatim as the Cookie header. */
  cookie?: string;
}

function decode(buf: Buffer, encoding?: string): string {
  try {
    if (encoding === "gzip") return gunzipSync(buf).toString("utf8");
    if (encoding === "deflate") return inflateSync(buf).toString("utf8");
    if (encoding === "br") return brotliDecompressSync(buf).toString("utf8");
  } catch {
    // A body we cannot decompress is a body we do not have. Falling through to
    // the raw bytes would hand the parser mojibake and call it data.
    return "";
  }
  return buf.toString("utf8");
}

export type Transport = (url: string, opts: HttpOptions) => Promise<HttpResponse>;

/**
 * The one seam the tests use. Every vendor call and the probe route go through
 * httpGet, so a stub set here exercises the real provider code rather than a
 * parallel copy of it. Nothing in the app ever sets this.
 */
let override: Transport | null = null;
export function setHttpTransport(t: Transport | null): void {
  override = t;
}

export function httpGet(url: string, opts: HttpOptions = {}): Promise<HttpResponse> {
  return override ? override(url, opts) : attempt(url, opts, 0);
}

function attempt(url: string, opts: HttpOptions, depth: number): Promise<HttpResponse> {
  return new Promise<HttpResponse>((resolve) => {
    let target: URL;
    try {
      target = new URL(url);
    } catch {
      resolve({ status: 0, body: "", cookies: [], error: "bad url" });
      return;
    }
    if (target.protocol !== "https:") {
      // Vendor traffic carries no secrets on this site, but an http: redirect
      // is still a downgrade and there is no reason to follow one.
      resolve({ status: 0, body: "", cookies: [], error: "not https" });
      return;
    }

    let settled = false;
    const done = (r: HttpResponse) => {
      if (settled) return;
      settled = true;
      resolve(r);
    };

    const headers: Record<string, string> = {
      "Accept-Encoding": "gzip, deflate, br",
      ...opts.headers,
    };
    if (opts.cookie) headers.Cookie = opts.cookie;

    const req = httpsRequest(
      target,
      { method: "GET", headers, timeout: opts.timeoutMs ?? DEFAULT_TIMEOUT_MS },
      (res) => {
        const status = res.statusCode ?? 0;
        const cookies = res.headers["set-cookie"] ?? [];
        const location = res.headers.location;

        if (status >= 300 && status < 400 && location && depth < MAX_REDIRECTS) {
          // Drain, or the socket is held open until it times out.
          res.resume();
          const next = new URL(location, target).toString();
          attempt(next, opts, depth + 1).then((r) =>
            // Cookies handed out mid-redirect still count; the session
            // endpoints answer with a redirect and set the cookie on the way.
            done({ ...r, cookies: [...cookies, ...r.cookies] })
          );
          return;
        }

        const chunks: Buffer[] = [];
        let size = 0;
        res.on("data", (c: Buffer) => {
          size += c.length;
          if (size > MAX_BYTES) {
            res.destroy();
            done({ status, body: "", cookies, error: "response too large" });
            return;
          }
          chunks.push(c);
        });
        res.on("end", () => {
          const enc = String(res.headers["content-encoding"] ?? "").toLowerCase();
          done({ status, body: decode(Buffer.concat(chunks), enc), cookies, error: null });
        });
        res.on("error", (e: Error) => done({ status, body: "", cookies, error: e.message }));
      }
    );

    req.on("timeout", () => {
      req.destroy();
      done({ status: 0, body: "", cookies: [], error: "timeout" });
    });
    req.on("error", (e: Error) =>
      done({ status: 0, body: "", cookies: [], error: e.message.slice(0, 160) })
    );
    req.end();
  });
}

/** The `name=value` pairs from Set-Cookie lines, joined for a Cookie header. */
export function cookieHeader(lines: readonly string[]): string {
  const jar = new Map<string, string>();
  for (const line of lines) {
    const pair = line.split(";", 1)[0];
    const eq = pair.indexOf("=");
    if (eq <= 0) continue;
    jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
  }
  return [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
}
