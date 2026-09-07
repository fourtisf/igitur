import { redirect } from "next/navigation";

import { trackHref } from "@/lib/routes";
import { FEATURED } from "@/lib/site";

/**
 * The nav links to /track with no book in mind. Redirect to the featured book's
 * own URL rather than rendering the same content at two addresses — duplicate
 * content under two canonicals is exactly what §6.1 is about.
 */
export default function TrackIndex() {
  redirect(trackHref(FEATURED));
}
