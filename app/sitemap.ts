import type { MetadataRoute } from "next";

import { NAMES_INDEX, nameHref } from "@/lib/names";
import { bookHref } from "@/lib/routes";
import { absolute } from "@/lib/site";
import { THEMES, UNIVERSE_VERSION } from "@/lib/universe";

/**
 * HANDOFF.md §6.1 — "sitemap.xml including one entry per theme claim".
 *
 * The static pages plus a book for each of the 26 written theses. Every one of
 * those is a real, server-rendered URL with its own canonical tag, which is the
 * whole point of the production build.
 *
 * Two things are deliberately absent:
 *   /history  differs for every reader and indexes nothing.
 *   /track    a track page is indexable only when its figures are real, which
 *             needs a working vendor *and* a stated date to measure from. The
 *             thesis URLs below carry no date, so theirs never are, whatever
 *             the server is configured with — an earlier note here promised to
 *             add them once real data landed, which would have published a
 *             synthetic return series. The page decides for itself, per URL,
 *             from the series it actually computed.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const statics: [string, number, MetadataRoute.Sitemap[number]["changeFrequency"]][] = [
    ["/", 1, "weekly"],
    ["/compose", 0.9, "monthly"],
    ["/ask", 0.8, "monthly"],
    ["/compare", 0.7, "monthly"],
    ["/universe", 0.8, "weekly"],
    ["/method", 0.8, "monthly"],
    ["/changes", 0.6, "weekly"],
    ["/trending", 0.7, "daily"],
    ["/ledger", 0.8, "daily"],
    ["/token", 0.6, "weekly"],
    ["/status", 0.6, "weekly"],
    ["/about", 0.4, "monthly"],
    ["/legal", 0.3, "yearly"],
  ];

  const pages: MetadataRoute.Sitemap = statics.map(([path, priority, changeFrequency]) => ({
    url: absolute(path),
    lastModified: now,
    changeFrequency,
    priority,
  }));

  for (const th of THEMES) {
    pages.push({
      url: absolute(bookHref(th.claim, [], { universe: UNIVERSE_VERSION })),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.7,
    });
  }

  // One page per published name. This is the largest indexable surface the
  // site has, and it is built entirely from data that already existed.
  for (const n of NAMES_INDEX) {
    pages.push({
      url: absolute(nameHref(n.ticker)),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.6,
    });
  }

  return pages;
}
