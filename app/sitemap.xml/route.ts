// app/sitemap.xml/route.ts
import { NextResponse } from "next/server";
import { headers } from "next/headers";

export const runtime = "nodejs";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function getRequestOrigin(): string {
  const h = headers();

  const proto =
    h.get("x-forwarded-proto") ??
    (process.env.NODE_ENV === "production" ? "https" : "http");

  const host =
    h.get("x-forwarded-host") ??
    h.get("host") ??
    "localhost:3000";

  return `${proto}://${host}`.replace(/\/+$/, "");
}

function getPreferredSiteUrl(origin: string): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.SITE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.APP_URL ??
    "";

  if (!isNonEmptyString(raw)) {
    return origin;
  }

  try {
    const u = new URL(raw.trim());
    return u.toString().replace(/\/+$/, "");
  } catch {
    return origin;
  }
}

export async function GET(): Promise<Response> {
  const origin = getRequestOrigin();
  const siteUrl = getPreferredSiteUrl(origin);

  const target = `${siteUrl}/api/seo/sitemap?format=xml`;

  try {
    const res = await fetch(target, {
      method: "GET",
      cache: "no-store",
    });

    const xml = await res.text();

    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: "Failed to generate sitemap.", details: xml.slice(0, 2000) },
        { status: 502, headers: { "Cache-Control": "no-store" } },
      );
    }

    return new NextResponse(xml, {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error.";
    return NextResponse.json(
      { ok: false, error: "Unexpected server error.", details: msg.slice(0, 2000) },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
