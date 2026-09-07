import type { MetadataRoute } from "next";

import { absolute } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Session-scoped and reader-specific; nothing to index.
        disallow: ["/history", "/api/"],
      },
    ],
    sitemap: absolute("/sitemap.xml"),
  };
}
