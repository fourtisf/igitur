import { THEMES } from "./universe";
import type { MatchableTheme } from "./generator";

/**
 * What the browser needs to score a premise as the reader types.
 *
 * The full universe is ~45KB, nearly all of it prose: the case for and against,
 * and a written reason on all 170 holdings. None of that is read by the
 * matcher, and none of it should cross the wire just to light up a theme name
 * in the composer.
 *
 * This carries the keyword lists and nothing else, and it is fed to the same
 * `scoreThemes` the book is built with — so the composer can never tell a
 * reader one thing and the book another. A test asserts the two agree.
 */
export interface IndexedTheme extends MatchableTheme {
  name: string;
  risk: string;
}

export const MATCH_INDEX: IndexedTheme[] = THEMES.map((t) => ({
  id: t.id,
  name: t.name,
  risk: t.risk,
  kw: t.kw,
  neg: t.neg,
}));
