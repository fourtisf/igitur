/**
 * Share cards for the pages that are not books.
 *
 * This is a fixed allowlist on purpose. The obvious alternative — letting the
 * OG route take arbitrary title and body text from the query string — would let
 * anyone mint a Igitur-branded image saying anything they liked. A book card
 * renders the reader's own premise because the premise *is* the content; a page
 * card renders only text that ships in this file.
 */

export interface PageCard {
  /** Section label. Omitted on the home card, where the wordmark already says it. */
  kicker?: string;
  title: string;
  body: string;
}

export const PAGE_CARDS = {
  home: {
    title: "Write what you believe. See what it holds.",
    body: "One sentence about the next decade goes in. A weighted portfolio comes out — and every weight carries the reason it earned its size.",
  },
  compose: {
    kicker: "Compose",
    title: "State the claim first.",
    body: "Name a constraint, an industry or a resource. Your sentence is matched against 26 written theses.",
  },
  trending: {
    kicker: "Trending",
    title: "Ranked by how far it moved.",
    body: "Nothing on the page is chosen. The order is a measurement, so a fall ranks alongside a rise of the same size.",
  },
  universe: {
    kicker: "The universe",
    title: "Published in the open.",
    body: "Every name a book can hold, with the reason it can earn weight and the conviction score that sets its size.",
  },
  method: {
    kicker: "Methodology",
    title: "How every number on this site was produced.",
    body: "Matching, weighting, and where the conviction scores come from — including the places the method is weak.",
  },
  token: {
    kicker: "Token",
    title: "$IGITUR",
    body: "The research tool is free and stays free. Published before launch, so it can be held against us afterwards.",
  },
  status: {
    kicker: "Status",
    title: "What is built, and what is not.",
    body: "No dates are attached to work that is not done. A line moves to the first list when it ships, and not before.",
  },
  about: {
    kicker: "About",
    title: "A prototype, built in the open.",
    body: "What Igitur is, and what it deliberately will not do.",
  },
  legal: {
    kicker: "Terms, disclosures and privacy",
    title: "The short version, in plain language.",
    body: "Research output, not investment advice. Synthetic data, no tracking, and the site never asks for a signature or a key.",
  },
  notfound: {
    kicker: "Not found",
    title: "That page does not exist.",
    body: "Every book has an address, but this is not one of them.",
  },
} as const satisfies Record<string, PageCard>;

export type PageCardId = keyof typeof PAGE_CARDS;

export function isPageCardId(v: string): v is PageCardId {
  return Object.hasOwn(PAGE_CARDS, v);
}

/** The share image URL for a non-book page. */
export function pageOg(id: PageCardId): string {
  return `/api/og?page=${id}`;
}
