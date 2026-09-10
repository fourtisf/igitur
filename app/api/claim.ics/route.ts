import { horizonLabel, monthsBetween } from "@/lib/horizon";
import { get } from "@/lib/ledger";
import { absolute, HOST, SITE } from "@/lib/site";

/**
 * A claim's settlement date, as a calendar file.
 *
 * ── Why this rather than an email ────────────────────────────────────────────
 *
 * The record's whole value is in being revisited: a dated claim nobody comes
 * back to is a dated claim nobody is held to. But the obvious way to bring
 * someone back — take their email and send them a reminder — would mean
 * keeping a list of people and what they believe, on a site whose commit
 * dialog promises that nothing about the author is stored.
 *
 * A calendar file has the same effect and inverts who holds the data. The
 * reader's own calendar does the reminding. This server records nothing,
 * learns nothing and has nothing to leak: the file is generated on request
 * from a public entry and forgotten.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Text inside an ICS value.
 *
 * This carries a premise written by a stranger straight into a line-delimited
 * file format, so an unescaped newline would not merely corrupt the file — it
 * would let the author append arbitrary calendar properties, or a whole second
 * event, to the calendar of everyone who downloads it. Backslash first, or the
 * escapes escape each other.
 */
export function escapeIcs(text: string): string {
  return (
    text
      .replace(/\\/g, "\\\\")
      .replace(/;/g, "\\;")
      .replace(/,/g, "\\,")
      // Any line break at all becomes the literal escape, never a real one.
      .replace(/\r\n|\r|\n/g, "\\n")
      // Control characters have no meaning in a premise, and several have
      // meaning to parsers.
      .replace(/[\u0000-\u001f\u007f]/g, "")
  );
}

/** RFC 5545 wants lines of at most 75 octets, continued with a leading space. */
export function fold(line: string): string {
  if (Buffer.byteLength(line, "utf8") <= 75) return line;
  const out: string[] = [];
  let current = "";
  for (const ch of line) {
    // Split on characters, not bytes: half a code point either side of a fold
    // is a mojibake calendar entry.
    if (Buffer.byteLength(current + ch, "utf8") > (out.length ? 74 : 75)) {
      out.push(current);
      current = ch;
    } else {
      current += ch;
    }
  }
  out.push(current);
  return out.join("\r\n ");
}

const stamp = (iso: string) => iso.replace(/-/g, "");

function nextDay(date: string): string {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id") ?? "";
  const entry = id ? await get(id) : null;
  if (!entry) return new Response("No such claim.", { status: 404 });
  if (!entry.settlesAt) {
    // An open-ended claim has no date to put in a calendar, and inventing one
    // would be this site asserting a deadline its author never chose.
    return new Response("This claim has no settlement date.", { status: 404 });
  }

  const months = monthsBetween(entry.statedAt, entry.settlesAt);
  const url = absolute(`/p/${entry.id}`);
  const body = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//${SITE.name}//Claim//EN`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${entry.id}@${HOST}`,
    `DTSTAMP:${stamp(entry.statedAt)}T000000Z`,
    // All-day: a claim settles on a date, not at an hour.
    `DTSTART;VALUE=DATE:${stamp(entry.settlesAt)}`,
    `DTEND;VALUE=DATE:${stamp(nextDay(entry.settlesAt))}`,
    fold(`SUMMARY:${escapeIcs(`A claim settles: ${entry.premise}`)}`),
    fold(
      `DESCRIPTION:${escapeIcs(
        `Stated on ${entry.statedAt} and standing for ${horizonLabel(months)}. ` +
          `On this date the record states whether the book beat the index, and stops. ${url}`
      )}`
    ),
    fold(`URL:${escapeIcs(url)}`),
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  return new Response(body + "\r\n", {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="igitur-${entry.id}.ics"`,
      "Cache-Control": "public, max-age=86400",
    },
  });
}
