// ============================================
// Imports
// ============================================

import type { MetadataRoute } from "next";

import { ROUTES } from "@/lib/config/routes";

import {
  DEFAULT_SITEMAP_RULES,
  SITEMAP_DEFAULTS,
  SITEMAP_EXCLUDE_PATHS,
} from "./constants";

import { buildSitemap } from "@/lib/seo/sitemap";


// ============================================
// Types
// ============================================

export type DynamicSitemapItem = {
  path: string;

  lastModified?: string | Date;

  changeFrequency?: MetadataRoute.Sitemap[number]["changeFrequency"];

  priority?: number;
};

export type SitemapGenerateInput = {
  blogs?: Array<{
    slug: string;
    updatedAt?: string | Date;
  }>;

  projects?: Array<{
    slug: string;
    updatedAt?: string | Date;
  }>;

  sections?: Array<{
    slug: string;
    updatedAt?: string | Date;
  }>;
};


// ============================================
// Helpers
// ============================================

const isExcludedPath = (
  path: string
) => {

  return SITEMAP_EXCLUDE_PATHS.some((excluded) =>
    path === excluded || path.startsWith(`${excluded}/`)
  );
};

const withDefaults = (
  path: string,
  lastModified?: string | Date,
  overrides?: Partial<DynamicSitemapItem>
): DynamicSitemapItem => {

  const rule =
    path === ROUTES.public.home
      ? DEFAULT_SITEMAP_RULES.home
      : path.startsWith(ROUTES.public.blogs)
      ? DEFAULT_SITEMAP_RULES.blogs
      : path.startsWith(ROUTES.public.projects)
      ? DEFAULT_SITEMAP_RULES.projects
      : path.startsWith(ROUTES.public.contact)
      ? DEFAULT_SITEMAP_RULES.contact
      : path.startsWith(ROUTES.public.resume)
      ? DEFAULT_SITEMAP_RULES.resume
      : SITEMAP_DEFAULTS;

  return {
    path,
    lastModified,

    changeFrequency:
      overrides?.changeFrequency ?? rule.changeFrequency,

    priority:
      overrides?.priority ?? rule.priority,
  };
};


// ============================================
// Generate Sitemap
// ============================================

export const generateSitemap = (
  input?: SitemapGenerateInput
): MetadataRoute.Sitemap => {

  const dynamic: DynamicSitemapItem[] = [];

  // ----------------------------
  // Blog pages
  // ----------------------------

  input?.blogs?.forEach((blog) => {

    const path = ROUTES.public.blog(blog.slug);

    if (isExcludedPath(path)) return;

    dynamic.push(
      withDefaults(path, blog.updatedAt)
    );
  });

  // ----------------------------
  // Project pages
  // ----------------------------

  input?.projects?.forEach((project) => {

    const path = ROUTES.public.project(project.slug);

    if (isExcludedPath(path)) return;

    dynamic.push(
      withDefaults(path, project.updatedAt)
    );
  });

  // ----------------------------
  // Dynamic section pages
  // ----------------------------

  input?.sections?.forEach((section) => {

    const path = ROUTES.public.section(section.slug);

    if (isExcludedPath(path)) return;

    dynamic.push(
      withDefaults(path, section.updatedAt)
    );
  });

  // ----------------------------
  // Build final sitemap
  // ----------------------------

  return buildSitemap({
    dynamic,
  });
};
