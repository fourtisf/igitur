/**
 * The wallet button, and the three failures it used to call one thing.
 *
 * Every error became "Connection rejected", which is true of exactly one of
 * them. The common one is -32002: the wallet's own prompt is already open,
 * usually behind the browser window, and nothing has been rejected at all.
 * Telling that reader they refused sends them to look in the wrong place —
 * which is what happened, and was reported as the button not working.
 *
 * Read as source: these are properties of what the component does with an
 * error, and a rendered assertion cannot reach a wallet extension.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync("components/Nav.tsx", "utf8");

test("each EIP-1193 failure gets its own answer", () => {
  for (const [code, why] of [
    ["4001", "the reader actually declined"],
    ["-32002", "a prompt is already open — nothing was declined"],
    ["4900", "the wallet is locked or disconnected"],
  ] as const) {
    assert.ok(src.includes(code), `${code} (${why}) must be handled distinctly`);
  }
  assert.ok(
    !/catch\s*\{\s*toast\("Connection rejected"\)/.test(src),
    "a blanket rejection message is the bug this replaced"
  );
});

test("a second click cannot produce the error it would be blamed for", () => {
  // Clicking twice is what CAUSES -32002: the second request arrives while the
  // first prompt is still open. Guarding is better than explaining.
  assert.match(src, /const \[asking, setAsking\]/, "an in-flight request must be tracked");
  assert.match(src, /if \(asking\)/, "a second click must be refused locally");
  assert.match(src, /finally \{\s*setAsking\(false\);/, "the guard must clear on every path");
});

test("an existing connection is restored without prompting", () => {
  // eth_accounts returns what is already authorised and never prompts. Without
  // it a connected wallet read as disconnected on every page load.
  assert.match(src, /method: "eth_accounts"/, "the page must ask what is already granted");
  const order = src.indexOf('"eth_accounts"');
  const prompt = src.indexOf('"eth_requestAccounts"');
  assert.ok(order > -1 && order < prompt, "the silent read must come before the prompting one");
});

test("it picks a provider when several wallets are installed", () => {
  // Two extensions each overwrite window.ethereum on load; the winner is
  // whichever ran last, so the button could open a wallet nobody expected.
  assert.match(src, /providers/, "the providers array must be considered");
  assert.match(src, /isMetaMask/, "a recognisable prompt is the one to prefer");
});

test("it still only ever reads an address", () => {
  // /legal promises the site never asks for a signature, a transaction, a seed
  // phrase or a key. Fixing the error handling must not have widened this.
  for (const forbidden of [
    "eth_sign", "personal_sign", "eth_sendTransaction", "signTypedData",
    "eth_signTransaction", "wallet_addEthereumChain",
  ]) {
    assert.ok(!src.includes(forbidden), `the site must never call ${forbidden}`);
  }
  const methods = [...src.matchAll(/method: "([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(
    [...new Set(methods)].sort(),
    ["eth_accounts", "eth_requestAccounts"],
    "only the two read-only account methods belong here"
  );
});

test("disconnecting does not claim more than it did", () => {
  // A dapp cannot revoke its own permission. The button clears the address
  // from the page; saying "disconnected" implied the wallet had acted.
  assert.match(src, /still lists the site/, "it must say where the permission actually lives");
});
