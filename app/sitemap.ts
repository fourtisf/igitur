import type { MetadataRoute } from "next";

import { bookHref, trackHref } from "@/lib/routes";
import { absolute } from "@/lib/site";
import { THEMES } from "@/lib/universe";

/**
 * HANDOFF.md §6.1 — "sitemap.xml including one entry per theme claim".
 *
 * The static pages plus a book and a track page for each of the 26 written
 * theses. Every one of those is a real, server-rendered URL with its own
 * canonical tag, which is the whole point of the production build.
 *
 * /history is excluded: it is different for every reader and indexes nothing.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const statics: [string, number, MetadataRoute.Sitemap[number]["changeFrequency"]][] = [
    ["/", 1, "weekly"],
    ["/compose", 0.9, "monthly"],
    ["/universe", 0.8, "weekly"],
    ["/method", 0.8, "monthly"],
    ["/trending", 0.7, "daily"],
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
      url: absolute(bookHref(th.claim)),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.7,
    });
    pages.push({
      url: absolute(trackHref(th.claim)),
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.5,
    });
  }

  return pages;
}
