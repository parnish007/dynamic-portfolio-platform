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
 * - Disallow admin + internal surfaces ONLY
 * - Public features (chat, chatbot, content, projects, blogs) remain crawlable
 * - Sitemap auto-linked
 */
export async function GET(): Promise<Response> {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.SITE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.APP_URL ??
    null;

  const normalizedSite = normalizeSiteUrl(siteUrl);

  // Staging / preview kill-switch
  const indexingAllowed = envBool("ROBOTS_INDEXING", true);

  const sitemapPathRaw = process.env.ROBOTS_SITEMAP_PATH ?? "/sitemap.xml";
  const sitemapPath = isNonEmptyString(sitemapPathRaw)
    ? sitemapPathRaw.startsWith("/")
      ? sitemapPathRaw.trim()
      : `/${sitemapPathRaw.trim()}`
    : "/sitemap.xml";

  const extraAdminDisallow = envList("ADMIN_ROBOTS_DISALLOW");

  const legacyAdminEnabled = envBool(
    "NEXT_PUBLIC_ENABLE_LEGACY_ADMIN_ROUTES",
    false
  );

  const lines: string[] = [];

  lines.push("User-agent: *");

  if (!indexingAllowed) {
    lines.push("Disallow: /");
  } else {
    lines.push("Allow: /");

    // Internal / framework paths
    lines.push("Disallow: /api/");
    lines.push("Disallow: /_next/");
    lines.push("Disallow: /favicon.ico");

    // Canonical admin routes
    lines.push("Disallow: /admin");
    lines.push("Disallow: /admin/");

    // Legacy admin routes (ONLY if explicitly enabled)
    if (legacyAdminEnabled) {
      lines.push("Disallow: /login");
      lines.push("Disallow: /dashboard");
      lines.push("Disallow: /content");
    }

    // Extra admin-only paths (env driven)
    for (const p of extraAdminDisallow) {
      lines.push(`Disallow: ${p}`);
    }
  }

  // Optional AI crawler blocking
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

  if (normalizedSite && indexingAllowed) {
    lines.push("");
    lines.push(`Sitemap: ${normalizedSite}${sitemapPath}`);
  }

  return new NextResponse(lines.join("\n"), {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
