/**
 * What the model service actually said, in a form that is safe to print.
 *
 * Three times on this site a bare `catch {}` has turned a one-line vendor
 * message into a day of guessing: the compare button, the wallet, the deploy
 * report. The assistant made it four. A caller that swallows the reason is
 * not being careful with the reader — it is hiding the only fact that would
 * have fixed the problem.
 *
 * Nothing here is decorative. A 401 means the key is wrong and no amount of
 * retrying helps; a 400 means the request shape is wrong and the deployment is
 * broken for everyone; a 429 means it will work again in a minute. Those are
 * three different sentences and the reader deserves the right one.
 */

export interface ModelError {
  /** HTTP status, when the request reached the service at all. */
  status: number | null;
  /** The vendor's own error type, e.g. authentication_error. */
  type: string | null;
  /** The message, truncated and with anything key-shaped removed. */
  message: string;
}

/** Keys have been pasted into screenshots once already on this project. */
function redact(s: string): string {
  return s
    .replace(/sk-ant-[A-Za-z0-9_-]+/g, "sk-ant-[redacted]")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]");
}

export function describeModelError(err: unknown): ModelError {
  const e = err as
    | { status?: unknown; name?: unknown; message?: unknown; error?: unknown }
    | null
    | undefined;

  const status = typeof e?.status === "number" ? e.status : null;

  // The SDK wraps the vendor body as { type: "error", error: { type, message } }.
  const body = (e?.error as { error?: { type?: unknown; message?: unknown } } | undefined)?.error;
  const type =
    typeof body?.type === "string"
      ? body.type
      : typeof e?.name === "string" && e.name !== "Error"
        ? e.name
        : null;

  const raw =
    typeof body?.message === "string"
      ? body.message
      : typeof e?.message === "string"
        ? e.message
        : String(err);

  return { status, type, message: redact(raw).slice(0, 300) };
}

/** One line for a server log: grep-able, and never the whole stack. */
export function logModelError(where: string, err: unknown): ModelError {
  const d = describeModelError(err);
  console.error(`[${where}] model request failed: ${d.status ?? "no status"} ${d.type ?? ""} ${d.message}`.trim());
  return d;
}

/**
 * The same failure, said to a reader rather than to a log.
 *
 * It names the status, because "could not answer just now" sent the owner of
 * this site looking in the wrong place for an hour.
 */
export function readerSentence(d: ModelError): string {
  const what =
    d.status === 401 || d.status === 403
      ? `the model service rejected this deployment's key (${d.status})`
      : d.status === 429
        ? "the model service is rate limiting this deployment (429)"
        : d.status === 400
          ? `the request was rejected as malformed (400${d.type ? `, ${d.type}` : ""})`
          : d.status
            ? `the model service returned ${d.status}${d.type ? ` (${d.type})` : ""}`
            : `the request did not complete${d.type ? ` (${d.type})` : ""}`;
  return `The assistant could not answer: ${what}. Everything it works from is published on /universe, /method and /status.`;
}
