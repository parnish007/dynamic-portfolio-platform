// ============================================
// Imports
// ============================================

import type { MetadataRoute } from "next";

import { ROUTES } from "@/lib/config/routes";

import {
  DEFAULT_SITEMAP_RULES,
  SITEMAP_DEFAULTS,
  SITEMAP_EXCLUDE_PATHS,
  type SitemapChangeFreq,
} from "./constants";


// ============================================
// Types
// ============================================

export type SitemapItemInput = {
  path: string;

  lastModified?: string | Date;

  changeFrequency?: MetadataRoute.Sitemap[number]["changeFrequency"];

  priority?: number;
};


// ============================================
// Path Helpers
// ============================================

export const normalizePath = (
  path: string
) => {

  if (!path) return "/";

  if (!path.startsWith("/")) return `/${path}`;

  return path;
};

export const isExcludedPath = (
  path: string
) => {

  const normalized = normalizePath(path);

  return SITEMAP_EXCLUDE_PATHS.some((excluded) => {
    const ex = normalizePath(excluded);
    return normalized === ex || normalized.startsWith(`${ex}/`);
  });
};


// ============================================
// Defaults / Rules
// ============================================

export const resolveDefaultRule = (
  path: string
) => {

  const p = normalizePath(path);

  if (p === ROUTES.public.home) return DEFAULT_SITEMAP_RULES.home;

  if (p === ROUTES.public.projects) return DEFAULT_SITEMAP_RULES.projects;

  if (p === ROUTES.public.blogs) return DEFAULT_SITEMAP_RULES.blogs;

  if (p === ROUTES.public.contact) return DEFAULT_SITEMAP_RULES.contact;

  if (p === ROUTES.public.resume) return DEFAULT_SITEMAP_RULES.resume;

  if (p.startsWith("/project/")) return DEFAULT_SITEMAP_RULES.projects;

  if (p.startsWith("/blog/")) return DEFAULT_SITEMAP_RULES.blogs;

  return SITEMAP_DEFAULTS;
};

export const clampPriority = (
  value?: number
) => {

  if (typeof value !== "number") return undefined;

  if (value < 0) return 0;
  if (value > 1) return 1;

  return value;
};

export const applyDefaults = (
  item: SitemapItemInput
): SitemapItemInput => {

  const rule = resolveDefaultRule(item.path);

  return {
    ...item,

    changeFrequency:
      item.changeFrequency ?? rule.changeFrequency,

    priority:
      clampPriority(item.priority ?? rule.priority),
  };
};


// ============================================
// Dedupe
// ============================================

export const dedupeByPath = (
  items: SitemapItemInput[]
) => {

  const map = new Map<string, SitemapItemInput>();

  for (const it of items) {

    const key = normalizePath(it.path);

    // Comment
    // Prefer item with a newer lastModified when both exist.

    const existing = map.get(key);

    if (!existing) {
      map.set(key, { ...it, path: key });
      continue;
    }

    const existingDate =
      existing.lastModified ? new Date(existing.lastModified).getTime() : 0;

    const newDate =
      it.lastModified ? new Date(it.lastModified).getTime() : 0;

    if (newDate >= existingDate) {
      map.set(key, { ...it, path: key });
    }
  }

  return Array.from(map.values());
};


// ============================================
// Bulk Helpers
// ============================================

export const filterExcluded = (
  items: SitemapItemInput[]
) => {

  return items.filter((it) => !isExcludedPath(it.path));
};

export const prepareSitemapInputs = (
  items: SitemapItemInput[]
) => {

  const normalized = items.map((it) => ({
    ...it,
    path: normalizePath(it.path),
  }));

  const filtered = filterExcluded(normalized);

  const withDefaults = filtered.map(applyDefaults);

  return dedupeByPath(withDefaults);
};


// ============================================
// Builders for Common Dynamic Inputs
// ============================================

export const buildBlogItem = (
  slug: string,
  updatedAt?: string | Date
): SitemapItemInput => {

  return {
    path: ROUTES.public.blog(slug),
    lastModified: updatedAt,
  };
};

export const buildProjectItem = (
  slug: string,
  updatedAt?: string | Date
): SitemapItemInput => {

  return {
    path: ROUTES.public.project(slug),
    lastModified: updatedAt,
  };
};

export const buildSectionItem = (
  slug: string,
  updatedAt?: string | Date
): SitemapItemInput => {

  return {
    path: ROUTES.public.section(slug),
    lastModified: updatedAt,
  };
};
