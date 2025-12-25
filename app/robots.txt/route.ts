// app/robots.txt/route.ts
import { NextResponse } from "next/server";

export const runtime = "edge";

/**
 * GET /robots.txt
 *
 * Fully dynamic, environment-driven robots.txt
 * - SEO-first
 * - Safe defaults
 * - Admin / private routes disallowed
 * - Sitemap auto-linked (no hardcoding)
 */
export async function GET(): Promise<Response> {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.SITE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.APP_URL ??
    "";

  const normalizedSite =
    siteUrl && siteUrl.startsWith("http")
      ? siteUrl.replace(/\/+$/, "")
      : "";

  const lines: string[] = [];

  // Default: allow all good bots
  lines.push("User-agent: *");
  lines.push("Allow: /");

  // Disallow admin & internal APIs
  lines.push("Disallow: /(admin)");
  lines.push("Disallow: /api/");
  lines.push("Disallow: /_next/");
  lines.push("Disallow: /favicon.ico");

  // Optional: block AI training bots if configured
  const blockAIBots =
    (process.env.BLOCK_AI_BOTS ?? "")
      .toString()
      .trim()
      .toLowerCase() === "true";

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

  // Sitemap reference (only if site URL is known)
  if (normalizedSite) {
    lines.push("");
    lines.push(`Sitemap: ${normalizedSite}/sitemap.xml`);
  }

  const body = lines.join("\n");

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
