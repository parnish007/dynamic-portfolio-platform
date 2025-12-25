// app/robots.txt/route.ts
import { NextResponse } from "next/server";

export const runtime = "edge";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeSiteUrl(raw: string | null): string | null {
  if (!isNonEmptyString(raw)) {
    return null;
  }
  const v = raw.trim();
  if (!v.startsWith("http")) {
    return null;
  }
  return v.replace(/\/+$/, "");
}

function envBool(name: string, fallback = false): boolean {
  const v = process.env[name];
  if (!isNonEmptyString(v)) {
    return fallback;
  }
  const x = v.trim().toLowerCase();
  return x === "true" || x === "1" || x === "yes";
}

function envList(name: string): string[] {
  const v = process.env[name];
  if (!isNonEmptyString(v)) {
    return [];
  }
  return v
    .split(",")
    .map((x) => x.trim())
    .filter((x) => x.length > 0)
    .map((x) => (x.startsWith("/") ? x : `/${x}`));
}

/**
 * GET /robots.txt
 *
 * Dynamic robots.txt
 * - SEO-first defaults
 * - Disallow internal build + API paths
 * - Disallow admin surfaces (supports both /admin/* and root-admin routes)
 * - Sitemap auto-linked (standard /sitemap.xml) with env override
 */
export async function GET(): Promise<Response> {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.SITE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.APP_URL ??
    null;

  const normalizedSite = normalizeSiteUrl(siteUrl);

  // If you ever want to lock down indexing in staging:
  // Set ROBOTS_INDEXING=false
  const indexingAllowed = envBool("ROBOTS_INDEXING", true);

  // Optional: allow custom sitemap route (ex: /api/seo/sitemap?format=xml)
  const sitemapPathRaw = process.env.ROBOTS_SITEMAP_PATH ?? "/sitemap.xml";
  const sitemapPath = isNonEmptyString(sitemapPathRaw)
    ? (sitemapPathRaw.startsWith("/") ? sitemapPathRaw.trim() : `/${sitemapPathRaw.trim()}`)
    : "/sitemap.xml";

  // Optional: extra admin paths you may add later (comma-separated)
  // Example: ADMIN_ROBOTS_DISALLOW="/admin,/admin/*,/studio"
  const extraAdminDisallow = envList("ADMIN_ROBOTS_DISALLOW");

  const lines: string[] = [];

  // Default rules
  lines.push("User-agent: *");

  if (!indexingAllowed) {
    // Hard block indexing (useful for preview/staging)
    lines.push("Disallow: /");
  } else {
    lines.push("Allow: /");

    // Internal / noisy paths
    lines.push("Disallow: /api/");
    lines.push("Disallow: /_next/");
    lines.push("Disallow: /favicon.ico");

    // Admin (recommended canonical admin prefix)
    lines.push("Disallow: /admin");
    lines.push("Disallow: /admin/");

    /**
     * Root-mounted admin routes (only disallow what is truly ADMIN)
     * Keep this list SMALL to avoid blocking public pages.
     * If any of these are public in your site, remove them.
     */
    lines.push("Disallow: /login");
    lines.push("Disallow: /dashboard");
    lines.push("Disallow: /content");
    lines.push("Disallow: /chat");
    lines.push("Disallow: /chatbot");

    // Env-driven extra admin disallows
    for (const p of extraAdminDisallow) {
      lines.push(`Disallow: ${p}`);
    }
  }

  // Optional: block AI training bots if configured
  const blockAIBots = envBool("BLOCK_AI_BOTS", false);

  if (blockAIBots) {
    lines.push("");
    lines.push("User-agent: GPTBot");
    lines.push("Disallow: /");

    lines.push("User-agent: Google-Extended");
    lines.push("Disallow: /");

    lines.push("User-agent: CCBot");
    lines.push("Disallow: /");

    lines.push("User-agent: ClaudeBot");
    lines.push("Disallow: /");
  }

  // Sitemap reference (only if site URL is known and indexing is allowed)
  if (normalizedSite && indexingAllowed) {
    lines.push("");
    lines.push(`Sitemap: ${normalizedSite}${sitemapPath}`);
  }

  const body = lines.join("\n");

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      // Cache 1 day (fine for robots)
      "Cache-Control": "public, max-age=86400",
    },
  });
}
