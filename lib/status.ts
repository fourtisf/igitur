/**
 * What is built, and what is not — the single copy.
 *
 * These lists lived inside app/status/page.tsx, which was fine while /status
 * was the only thing that read them. It is not any more: the assistant behind
 * /ask answers questions about this site, and an assistant working from a
 * second copy would eventually promise a feature the status page calls
 * unbuilt. One list, two readers.
 *
 * HANDOFF.md §14: keep these published, and move a line only when it ships.
 */

export const ALWAYS_LIVE = [
  "Compose a book from a premise the universe carries — and a refusal when it does not",
  "Negative keywords to stop cross-sector mismatches",
  "A ranked way out of a refusal, naming the term that vetoed a theme",
  "Igitur's own 26 theses on the record, on the same terms as anyone else's",
  "Written case for and against, every time",
  "Remove a holding and reweight the book",
  "Session history of everything you built",
  "Prices and market caps on every holding",
  "Filter the universe and the trending table",
  "A shareable address per book, no account",
  "Server-rendered routes with a canonical URL per page",
  "A generated preview image per book, and per page",
  "Share a book straight to X",
  "Performance against the index, honestly centred",
  "A dated public record of any claim you choose to commit",
  "A permanent page per committed claim, measured from the server's date",
  "Forking someone else's claim: same belief, your own weights, its own entry",
  "Published methodology with its own weak points",
  "Wallet connection for any EVM wallet",
  "Published tokenomics ahead of any launch",
];

export const ALWAYS_MISSING = [
  "Reading filings and news at generation time",
  "Conviction scores tied to disclosed segment revenue",
  "Following other people's books, and a feed of new claims",
  "Session history that survives a page refresh — only a committed claim persists",
  "Placing an order through a broker",
  "The token contract — not deployed",
  "Every utility listed on the token page",
];
