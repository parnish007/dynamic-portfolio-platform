// app/api/seo/sitemap/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type ChangeFreq =
  | "always"
  | "hourly"
  | "daily"
  | "weekly"
  | "monthly"
  | "yearly"
  | "never";

type SitemapUrl = {
  loc: string;
  lastmod?: string;
  changefreq?: ChangeFreq;
  priority?: number;
};

type ApiOk = {
  ok: true;
  generatedAt: string;
  siteUrl: string;
  counts: {
    sections: number;
    projects: number;
    blogs: number;
    total: number;
  };
  urls: SitemapUrl[];
};

type ApiErr = {
  ok: false;
  error: string;
  details?: string;
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function clampNumber(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.min(max, Math.max(min, value));
  }
  if (typeof value === "string") {
    const n = Number.parseFloat(value);
    if (Number.isFinite(n)) {
      return Math.min(max, Math.max(min, n));
    }
  }
  return fallback;
}

function safeIsoDate(value: unknown): string | undefined {
  if (!isNonEmptyString(value)) return undefined;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

function normalizePath(input: string): string {
  const raw = input.trim();
  if (!raw) return "/";

  const withoutQuery = raw.split("?")[0] ?? raw;
  const withSlash = withoutQuery.startsWith("/") ? withoutQuery : `/${withoutQuery}`;
  const cleaned = withSlash.replace(/\/{2,}/g, "/");

  if (cleaned.length > 1 && cleaned.endsWith("/")) {
    return cleaned.slice(0, -1);
  }

  return cleaned;
}

function buildAbsoluteUrl(siteUrl: string, path: string): string {
  const base = siteUrl.replace(/\/+$/, "");
  const p = normalizePath(path);
  return `${base}${p === "/" ? "" : p}`;
}

function xmlEscape(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function toSitemapXml(urls: SitemapUrl[]): string {
  const body = urls
    .map((u) => {
      const parts: string[] = [];
      parts.push("<url>");
      parts.push(`<loc>${xmlEscape(u.loc)}</loc>`);

      if (isNonEmptyString(u.lastmod)) {
        parts.push(`<lastmod>${xmlEscape(u.lastmod)}</lastmod>`);
      }

      if (isNonEmptyString(u.changefreq)) {
        parts.push(`<changefreq>${xmlEscape(u.changefreq)}</changefreq>`);
      }

      if (typeof u.priority === "number" && Number.isFinite(u.priority)) {
        parts.push(`<priority>${u.priority.toFixed(1)}</priority>`);
      }

      parts.push("</url>");
      return parts.join("");
    })
    .join("");

  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">` +
    body +
    `</urlset>`
  );
}

function jsonErr(error: string, status: number, details?: string): Response {
  const payload: ApiErr = { ok: false, error };
  if (isNonEmptyString(details)) payload.details = details.slice(0, 2000);
  return NextResponse.json(payload, { status, headers: { "Cache-Control": "no-store" } });
}

function getSiteUrl(): string | null {
  const candidates = [
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.SITE_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.APP_URL,
  ].filter(isNonEmptyString);

  const first = candidates[0] ?? null;
  if (!first) return null;

  try {
    const u = new URL(first);
    return u.toString().replace(/\/+$/, "");
  } catch {
    return null;
  }
}

/**
 * Admin protection for sitemap unpublished mode.
 * - If SITEMAP_ADMIN_SECRET is set, require:
 *   x-sitemap-admin-secret: <secret>
 *
 * Temporary until your real admin auth is wired.
 */
function isSitemapAdminAuthorized(request: Request): boolean {
  const secret = process.env.SITEMAP_ADMIN_SECRET;
  if (!isNonEmptyString(secret)) return false;
  const header = request.headers.get("x-sitemap-admin-secret");
  if (!isNonEmptyString(header)) return false;
  return header.trim() === secret.trim();
}

/**
 * Public route must use ANON key only.
 */
function getSupabaseConfig(): { url: string; anonKey: string } | null {
  const url =
    process.env.SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_URL ??
    "";

  const anonKey =
    process.env.SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    "";

  if (!isNonEmptyString(url) || !isNonEmptyString(anonKey)) {
    return null;
  }

  return { url: String(url).trim().replace(/\/$/, ""), anonKey: String(anonKey).trim() };
}

async function postgrestSelect(args: {
  supabaseUrl: string;
  supabaseKey: string;
  table: string;
  select: string;
  filters?: Array<{ key: string; value: string }>;
  order?: string;
}): Promise<Array<Record<string, unknown>>> {
  const url = new URL(`${args.supabaseUrl}/rest/v1/${encodeURIComponent(args.table)}`);
  url.searchParams.set("select", args.select);

  // Use append so repeated keys don't overwrite.
  for (const f of args.filters ?? []) {
    url.searchParams.append(f.key, f.value);
  }

  if (isNonEmptyString(args.order)) {
    url.searchParams.set("order", args.order);
  }

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      apikey: args.supabaseKey,
      Authorization: `Bearer ${args.supabaseKey}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text.slice(0, 2000));
  }

  const json = (await res.json()) as unknown;
  if (!Array.isArray(json)) return [];
  return json as Array<Record<string, unknown>>;
}

function getChangefreq(value: unknown): ChangeFreq | undefined {
  if (!isNonEmptyString(value)) return undefined;
  const v = value.trim().toLowerCase();
  if (
    v === "always" ||
    v === "hourly" ||
    v === "daily" ||
    v === "weekly" ||
    v === "monthly" ||
    v === "yearly" ||
    v === "never"
  ) {
    return v;
  }
  return undefined;
}

function readSitemapOverrides(obj: unknown): {
  exclude?: boolean;
  changefreq?: ChangeFreq;
  priority?: number;
  lastmod?: string;
} {
  if (!isPlainObject(obj)) return {};

  const exclude = obj.exclude === true;

  const changefreq = getChangefreq(obj.changefreq);
  const priority =
    obj.priority === undefined ? undefined : clampNumber(obj.priority, 0.5, 0.0, 1.0);

  const lastmod = safeIsoDate(obj.lastmod);

  return { exclude, changefreq, priority, lastmod };
}

function computeSectionDefaults(args: { depth: number }): { changefreq: ChangeFreq; priority: number } {
  const d = Math.max(0, Math.min(10, args.depth));
  const priority = Math.max(0.1, 1.0 - d * 0.08);
  const changefreq: ChangeFreq = d <= 1 ? "weekly" : d <= 3 ? "monthly" : "yearly";
  return { changefreq, priority: Number(priority.toFixed(2)) };
}

function computeItemDefaults(args: { kind: "blog" | "project" }): { changefreq: ChangeFreq; priority: number } {
  if (args.kind === "blog") return { changefreq: "weekly", priority: 0.7 };
  return { changefreq: "monthly", priority: 0.6 };
}

export async function GET(request: Request): Promise<Response> {
  const siteUrl = getSiteUrl();
  if (!siteUrl) {
    return jsonErr(
      "Missing site URL configuration.",
      500,
      "Set NEXT_PUBLIC_SITE_URL (recommended) or SITE_URL to your production domain (e.g. https://yourdomain.com).",
    );
  }

  const sb = getSupabaseConfig();
  if (!sb) {
    return jsonErr(
      "Missing Supabase configuration.",
      500,
      "Set SUPABASE_URL and SUPABASE_ANON_KEY.",
    );
  }

  const url = new URL(request.url);
  const format = (url.searchParams.get("format") ?? "json").toLowerCase();

  const includeUnpublishedRequested = url.searchParams.get("includeUnpublished") === "true";
  const includeUnpublished = includeUnpublishedRequested ? isSitemapAdminAuthorized(request) : false;

  if (includeUnpublishedRequested && !includeUnpublished) {
    return jsonErr("Unauthorized.", 401, "Missing/invalid x-sitemap-admin-secret.");
  }

  const sectionsTable = isNonEmptyString(process.env.SUPABASE_SECTIONS_TABLE)
    ? String(process.env.SUPABASE_SECTIONS_TABLE).trim()
    : "sections";

  const sectionsTreeTable = isNonEmptyString(process.env.SUPABASE_SECTIONS_TREE_TABLE)
    ? String(process.env.SUPABASE_SECTIONS_TREE_TABLE).trim()
    : "sections_tree";

  const projectsTable = isNonEmptyString(process.env.SUPABASE_PROJECTS_TABLE)
    ? String(process.env.SUPABASE_PROJECTS_TABLE).trim()
    : "projects";

  const blogsTable = isNonEmptyString(process.env.SUPABASE_BLOGS_TABLE)
    ? String(process.env.SUPABASE_BLOGS_TABLE).trim()
    : "blogs";

  const publishedCol = isNonEmptyString(process.env.SUPABASE_PUBLISHED_COLUMN)
    ? String(process.env.SUPABASE_PUBLISHED_COLUMN).trim()
    : "is_published";

  const treePublishedCol = isNonEmptyString(process.env.SUPABASE_TREE_PUBLISHED_COLUMN)
    ? String(process.env.SUPABASE_TREE_PUBLISHED_COLUMN).trim()
    : "is_published";

  const treeFullPathCol = isNonEmptyString(process.env.SUPABASE_TREE_FULLPATH_COLUMN)
    ? String(process.env.SUPABASE_TREE_FULLPATH_COLUMN).trim()
    : "full_path";

  const treeSlugCol = isNonEmptyString(process.env.SUPABASE_TREE_SLUG_COLUMN)
    ? String(process.env.SUPABASE_TREE_SLUG_COLUMN).trim()
    : "slug";

  const treeTypeCol = isNonEmptyString(process.env.SUPABASE_TREE_TYPE_COLUMN)
    ? String(process.env.SUPABASE_TREE_TYPE_COLUMN).trim()
    : "type";

  const treeMetaCol = isNonEmptyString(process.env.SUPABASE_TREE_META_COLUMN)
    ? String(process.env.SUPABASE_TREE_META_COLUMN).trim()
    : "meta";

  const sectionSeoCol = isNonEmptyString(process.env.SUPABASE_SECTION_SEO_COLUMN)
    ? String(process.env.SUPABASE_SECTION_SEO_COLUMN).trim()
    : "seo";

  const itemSeoCol = isNonEmptyString(process.env.SUPABASE_ITEM_SEO_COLUMN)
    ? String(process.env.SUPABASE_ITEM_SEO_COLUMN).trim()
    : "seo";

  // Build sitemap URLs (dedupe by loc).
  const byLoc = new Map<string, SitemapUrl>();

  // Always include homepage.
  byLoc.set(buildAbsoluteUrl(siteUrl, "/"), {
    loc: buildAbsoluteUrl(siteUrl, "/"),
    changefreq: "weekly",
    priority: 1.0,
  });

  let sectionsCount = 0;
  let projectsCount = 0;
  let blogsCount = 0;

  try {
    // 1) Sections from tree (preferred).
    // Safe default: only include "section" nodes in sitemap.
    // Folder nodes are included only if meta.sitemap.includeFolderRoute === true.
    const treeFilters: Array<{ key: string; value: string }> = [];
    if (!includeUnpublished) {
      treeFilters.push({ key: treePublishedCol, value: "eq.true" });
    }

    const treeRows = await postgrestSelect({
      supabaseUrl: sb.url,
      supabaseKey: sb.anonKey,
      table: sectionsTreeTable,
      select: `id,${treeTypeCol},${treeSlugCol},${treeFullPathCol},parent_id,order,updated_at,created_at,${treeMetaCol}`,
      filters: treeFilters,
      order: "parent_id.asc,order.asc,updated_at.desc,id.asc",
    });

    for (const row of treeRows) {
      const typeRaw = row[treeTypeCol];
      const type = isNonEmptyString(typeRaw) ? typeRaw.trim() : "";

      const meta = row[treeMetaCol];

      const sitemapOverrides = (() => {
        if (!isPlainObject(meta)) return {};
        const sitemapObj = (meta as Record<string, unknown>).sitemap;
        return readSitemapOverrides(sitemapObj);
      })();

      if (sitemapOverrides.exclude) continue;

      const includeFolderRoute =
        isPlainObject(meta) &&
        isPlainObject((meta as Record<string, unknown>).sitemap) &&
        ((meta as Record<string, unknown>).sitemap as Record<string, unknown>).includeFolderRoute === true;

      const includeThis = type === "section" || (type === "folder" && includeFolderRoute);
      if (!includeThis) continue;

      const fullPathRaw = row[treeFullPathCol];
      const slugRaw = row[treeSlugCol];

      const rawPath = isNonEmptyString(fullPathRaw)
        ? String(fullPathRaw)
        : isNonEmptyString(slugRaw)
          ? String(slugRaw)
          : "";

      const path = normalizePath(rawPath);

      const depth = path === "/" ? 0 : path.split("/").filter(Boolean).length;
      const defaults = computeSectionDefaults({ depth });

      const lastmod =
        sitemapOverrides.lastmod ??
        safeIsoDate(row.updated_at) ??
        safeIsoDate(row.created_at);

      const loc = buildAbsoluteUrl(siteUrl, path);

      byLoc.set(loc, {
        loc,
        lastmod,
        changefreq: sitemapOverrides.changefreq ?? defaults.changefreq,
        priority: sitemapOverrides.priority ?? defaults.priority,
      });

      sectionsCount += 1;
    }

    // 2) Projects
    const projectFilters: Array<{ key: string; value: string }> = [];
    if (!includeUnpublished) {
      projectFilters.push({ key: publishedCol, value: "eq.true" });
    }

    const projectRows = await postgrestSelect({
      supabaseUrl: sb.url,
      supabaseKey: sb.anonKey,
      table: projectsTable,
      select: `id,slug,updated_at,created_at,${itemSeoCol},${publishedCol}`,
      filters: projectFilters,
      order: "updated_at.desc,created_at.desc,id.desc",
    });

    for (const row of projectRows) {
      const slug = row.slug;
      if (!isNonEmptyString(slug)) continue;

      const seo = row[itemSeoCol];
      const overrides = (() => {
        if (!isPlainObject(seo)) return {};
        const sitemapObj = (seo as Record<string, unknown>).sitemap;
        return readSitemapOverrides(sitemapObj);
      })();

      if (overrides.exclude) continue;

      const defaults = computeItemDefaults({ kind: "project" });
      const lastmod = overrides.lastmod ?? safeIsoDate(row.updated_at) ?? safeIsoDate(row.created_at);

      const loc = buildAbsoluteUrl(siteUrl, `/project/${String(slug).trim()}`);

      byLoc.set(loc, {
        loc,
        lastmod,
        changefreq: overrides.changefreq ?? defaults.changefreq,
        priority: overrides.priority ?? defaults.priority,
      });

      projectsCount += 1;
    }

    // 3) Blogs
    const blogFilters: Array<{ key: string; value: string }> = [];
    if (!includeUnpublished) {
      blogFilters.push({ key: publishedCol, value: "eq.true" });
    }

    const blogRows = await postgrestSelect({
      supabaseUrl: sb.url,
      supabaseKey: sb.anonKey,
      table: blogsTable,
      select: `id,slug,updated_at,created_at,${itemSeoCol},${publishedCol}`,
      filters: blogFilters,
      order: "updated_at.desc,created_at.desc,id.desc",
    });

    for (const row of blogRows) {
      const slug = row.slug;
      if (!isNonEmptyString(slug)) continue;

      const seo = row[itemSeoCol];
      const overrides = (() => {
        if (!isPlainObject(seo)) return {};
        const sitemapObj = (seo as Record<string, unknown>).sitemap;
        return readSitemapOverrides(sitemapObj);
      })();

      if (overrides.exclude) continue;

      const defaults = computeItemDefaults({ kind: "blog" });
      const lastmod = overrides.lastmod ?? safeIsoDate(row.updated_at) ?? safeIsoDate(row.created_at);

      const loc = buildAbsoluteUrl(siteUrl, `/blog/${String(slug).trim()}`);

      byLoc.set(loc, {
        loc,
        lastmod,
        changefreq: overrides.changefreq ?? defaults.changefreq,
        priority: overrides.priority ?? defaults.priority,
      });

      blogsCount += 1;
    }

    // 4) Optional: apply section-level sitemap overrides from sections table (if matching loc).
    const sectionFilters: Array<{ key: string; value: string }> = [];
    if (!includeUnpublished) {
      sectionFilters.push({ key: publishedCol, value: "eq.true" });
    }

    const sectionRows = await postgrestSelect({
      supabaseUrl: sb.url,
      supabaseKey: sb.anonKey,
      table: sectionsTable,
      select: `id,slug,path,updated_at,created_at,${sectionSeoCol},${publishedCol}`,
      filters: sectionFilters,
      order: "updated_at.desc,created_at.desc,id.desc",
    });

    for (const row of sectionRows) {
      const pathValue =
        isNonEmptyString(row.path)
          ? String(row.path)
          : isNonEmptyString(row.slug)
            ? `/${String(row.slug)}`
            : null;

      if (!pathValue) continue;

      const loc = buildAbsoluteUrl(siteUrl, normalizePath(pathValue));
      const existing = byLoc.get(loc);
      if (!existing) continue;

      const seo = row[sectionSeoCol];
      const overrides = (() => {
        if (!isPlainObject(seo)) return {};
        const sitemapObj = (seo as Record<string, unknown>).sitemap;
        return readSitemapOverrides(sitemapObj);
      })();

      if (overrides.exclude) {
        byLoc.delete(loc);
        continue;
      }

      byLoc.set(loc, {
        loc,
        lastmod:
          overrides.lastmod ??
          existing.lastmod ??
          safeIsoDate(row.updated_at) ??
          safeIsoDate(row.created_at),
        changefreq: overrides.changefreq ?? existing.changefreq,
        priority: overrides.priority ?? existing.priority,
      });
    }

    const finalUrls = Array.from(byLoc.values()).sort((a, b) => a.loc.localeCompare(b.loc));

    if (format === "xml") {
      const xml = toSitemapXml(finalUrls);
      return new NextResponse(xml, {
        status: 200,
        headers: {
          "Content-Type": "application/xml; charset=utf-8",
          "Cache-Control": "no-store",
        },
      });
    }

    const payload: ApiOk = {
      ok: true,
      generatedAt: new Date().toISOString(),
      siteUrl,
      counts: {
        sections: sectionsCount,
        projects: projectsCount,
        blogs: blogsCount,
        total: finalUrls.length,
      },
      urls: finalUrls,
    };

    return NextResponse.json(payload, { status: 200, headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error.";
    return jsonErr("Failed to generate sitemap.", 502, msg);
  }
}

export async function POST(): Promise<Response> {
  return jsonErr("Method not allowed.", 405);
}

export async function PATCH(): Promise<Response> {
  return jsonErr("Method not allowed.", 405);
}

export async function DELETE(): Promise<Response> {
  return jsonErr("Method not allowed.", 405);
}
