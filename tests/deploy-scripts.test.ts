/**
 * The deploy scripts, read as text.
 *
 * These pin two failures that produce no error message at all, which is what
 * makes them worth a test rather than a comment.
 *
 * The first happened: `git reset --hard origin/HEAD` left the server on
 * c1743da while the branch was at 8ea4650, and `update-igitur.sh` reported
 * "sudah terbaru" on every run. `git fetch` does not maintain
 * refs/remotes/origin/HEAD, and `git clone --depth 1` — what deploy-igitur.sh
 * runs — never creates it. So the ref holds whatever commit it was given, for
 * ever, and every later step builds, tests and reports success on stale code.
 *
 * The second has not happened yet and would be worse. The repository was
 * renamed premise → igitur. GitHub still redirects the old URL, so a script
 * pointing at it keeps working — until somebody registers the freed name, at
 * which point the redirect breaks and the deploy clones a stranger's
 * repository onto the server.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const scripts = readdirSync("scripts")
  .filter((f) => f.endsWith(".sh"))
  .map((f) => [f, readFileSync(join("scripts", f), "utf8")] as const);

test("there are deploy scripts to check", () => {
  assert.ok(scripts.length >= 2, "scripts/ should hold the deploy shell scripts");
});

test("no script resets the checkout to origin/HEAD", () => {
  for (const [name, src] of scripts) {
    // Comments explain the rule and necessarily name the ref.
    const code = src
      .split("\n")
      .filter((l) => !/^\s*#/.test(l))
      .join("\n");
    assert.doesNotMatch(
      code,
      /reset\s+--hard\s+["']?origin\/HEAD/,
      `${name} resets to origin/HEAD, which fetch never updates and a shallow clone never creates`
    );
  }
});

test("a script that resets also proves the reset landed", () => {
  // Resetting to the right ref is half of it. The other half is noticing when
  // the reset did not move: silence there is how stale code gets built, tested
  // and reported as a successful deploy.
  for (const [name, src] of scripts) {
    if (!/reset\s+--hard/.test(src)) continue;
    if (name !== "update-igitur.sh") continue;
    assert.match(
      src,
      /rev-parse "origin\/\$BRANCH"/,
      `${name} must read back origin/$BRANCH after resetting to it`
    );
    assert.match(
      src,
      /\[ "\$NEW_COMMIT" = "\$WANT" \] \|\| die/,
      `${name} must stop when the reset did not land`
    );
  }
});

test("the clone URL is this repository's current name, not one that redirects", () => {
  // The old name is not wrong today — it is unowned tomorrow.
  for (const [name, src] of scripts) {
    const repo = /^REPO="([^"]+)"/m.exec(src);
    if (!repo) continue;
    assert.match(
      repo[1],
      /github\.com\/fourtisf\/igitur(\.git)?$/,
      `${name} clones from ${repo[1]}, which is not this repository's current address`
    );
  }
});
