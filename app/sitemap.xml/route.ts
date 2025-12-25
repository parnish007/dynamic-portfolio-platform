import { NextResponse } from "next";

/**
 * Dynamic sitemap.xml
 * App Router compatible
 * SEO-safe placeholder (DB-driven later)
 */

export async function GET() {
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const urls: string[] = [
    "/",            // Home
    "/resume",      // Resume
    "/contact",     // Contact
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset
  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
>
  ${urls
    .map(
      (path) => `
    <url>
      <loc>${baseUrl}${path}</loc>
      <changefreq>weekly</changefreq>
      <priority>${path === "/" ? "1.0" : "0.7"}</priority>
    </url>`
    )
    .join("")}
</urlset>
`;

  return new NextResponse(xml.trim(), {
    headers: {
      "Content-Type": "application/xml",
    },
  });
}
