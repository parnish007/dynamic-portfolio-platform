// ============================================
// Imports
// ============================================

import type { MetadataRoute } from "next";

import { APP_CONFIG } from "@/lib/config/app";

import { ROUTES } from "@/lib/config/routes";


// ============================================
// Types
// ============================================

export type SitemapItemInput = {
  path: string;

  lastModified?: string | Date;

  changeFrequency?:
    | "always"
    | "hourly"
    | "daily"
    | "weekly"
    | "monthly"
    | "yearly"
    | "never";

  priority?: number;
};

export type SitemapBuildInput = {
  dynamic?: SitemapItemInput[];

  includeAdmin?: boolean;
};


// ============================================
// Helpers
// ============================================

const absoluteUrl = (
  path: string
) => {

  const base = APP_CONFIG.url.endsWith("/")
    ? APP_CONFIG.url.slice(0, -1)
    : APP_CONFIG.url;

  const cleanPath = path.startsWith("/")
    ? path
    : `/${path}`;

  return `${base}${cleanPath}`;
};

const toDate = (
  value?: string | Date
) => {

  if (!value) return undefined;

  if (value instanceof Date) return value;

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) return undefined;

  return parsed;
};

const clampPriority = (
  value?: number
) => {

  if (typeof value !== "number") return undefined;

  if (value < 0) return 0;
  if (value > 1) return 1;

  return value;
};

const uniqByUrl = (
  items: MetadataRoute.Sitemap
) => {

  const map = new Map<string, MetadataRoute.Sitemap[number]>();

  for (const it of items) {
    map.set(it.url, it);
  }

  return Array.from(map.values());
};


// ============================================
// Defaults (Static Public Routes)
// ============================================

export const getStaticSitemapEntries = (): SitemapItemInput[] => {

  return [
    {
      path: ROUTES.public.home,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      path: ROUTES.public.projects,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      path: ROUTES.public.blogs,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      path: ROUTES.public.contact,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      path: ROUTES.public.resume,
      changeFrequency: "monthly",
      priority: 0.6,
    },
  ];
};


// ============================================
// Build Sitemap (Static + Dynamic)
// ============================================

export const buildSitemap = (
  input?: SitemapBuildInput
): MetadataRoute.Sitemap => {

  const base = getStaticSitemapEntries();

  const dynamic = input?.dynamic ?? [];

  const allInputs = [...base, ...dynamic];

  // Comment
  // Admin routes should not be indexed. Keep them out by default.
  // You can force includeAdmin for special use cases.

  const filteredInputs = input?.includeAdmin
    ? allInputs
    : allInputs.filter((it) => !it.path.startsWith("/admin"));

  const mapped: MetadataRoute.Sitemap = filteredInputs.map((it) => ({
    url: absoluteUrl(it.path),
    lastModified: toDate(it.lastModified),
    changeFrequency: it.changeFrequency,
    priority: clampPriority(it.priority),
  }));

  return uniqByUrl(mapped);
};
