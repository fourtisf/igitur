import type { NextConfig } from "next";

/**
 * Security headers.
 *
 * The one that matters most here is frame-ancestors. Without it any third
 * party can iframe this site and render it inside their own page — proven
 * during review by loading /token, wallet button and all, inside an attacker
 * page. For a site that connects wallets and whose /token page warns that "any
 * contract address circulating right now is fake", that is not a theoretical
 * risk: a scammer can frame the real page and overlay a fake address, so the
 * victim sees genuine branding on the scammer's URL.
 *
 * Note on script-src: Next injects inline bootstrap scripts, so 'unsafe-inline'
 * is required unless every page is made dynamic and served with a nonce via
 * middleware. That trade would cost the static prerendering of nine pages, so
 * it is left out for now — the protections that do not depend on it
 * (frame-ancestors, object-src, base-uri, form-action) are all in place.
 */
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  // Legacy backstop for browsers that predate frame-ancestors.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Modern browsers already default to this; stating it removes the dependency
  // on that default, so a reader's premise never travels in a Referer header.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Emits .next/standalone — a self-contained server with only the node_modules
  // it actually uses. That is what gets copied to the VPS; see DEPLOY.md.
  output: "standalone",

  /**
   * The ledger reads a path from the environment, which Next cannot resolve
   * statically, so it traces the whole project into the standalone output as a
   * precaution. That swept in 4.5MB the server never opens: the brand assets,
   * the prototype the fidelity test reads at build time, and the lockfile.
   * Excluding them is safe precisely because nothing at runtime reads them.
   */
  outputFileTracingExcludes: {
    "*": ["brand/**", "premise.html", "package-lock.json", "tests/**", "scripts/**", "docs/**"],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default config;
