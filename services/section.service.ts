// services/section.service.ts

import type {
  SectionTreeNode,
  SectionBreadcrumb,
  SectionRouteData,
} from "@/types/section";

/**
 * ⚠️ STAGE 2 NOTE
 * Placeholder Section service (DEV ONLY).
 *
 * - In-memory tree simulating Supabase-backed infinite nesting
 * - Path-driven routing (folder-like sections/subsections)
 * - SEO-safe flags (visible/published/noindex)
 *
 * In later stages:
 * - Replace internals with DB queries
 * - KEEP function signatures stable
 */

/* -------------------------------------------------------------------------- */
/* Placeholder in-memory section tree (DEV ONLY)                               */
/* -------------------------------------------------------------------------- */

const SECTION_TREE: SectionTreeNode = {
  id: "root",
  parentId: null,
  title: "Root",
  description: "",
  slug: "",
  path: "/",
  layoutPreset: "grid",
  orientation: "vertical",
  density: "normal",
  visible: true,
  published: true,
  enable3d: false,
  seo: {
    title: "Home",
    description: "Root section",
    canonicalPath: "/",
    noindex: false,
    keywords: [],
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  children: [],
};

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function normalizePath(path: string): string {
  const trimmed = path.trim();

  if (!trimmed) {
    return "/";
  }

  if (trimmed === "/") {
    return "/";
  }

  const noTrailingSlash = trimmed.endsWith("/")
    ? trimmed.slice(0, -1)
    : trimmed;

  return noTrailingSlash.startsWith("/") ? noTrailingSlash : `/${noTrailingSlash}`;
}

function slugsToNormalizedPath(slugs: string[]): string {
  if (!slugs.length) {
    return "/";
  }

  const parts = slugs
    .map((s) => s.trim())
    .filter(Boolean);

  if (!parts.length) {
    return "/";
  }

  return normalizePath("/" + parts.join("/"));
}

function isPubliclyAccessible(node: SectionTreeNode): boolean {
  return Boolean(node.visible && node.published);
}

function isIndexableForSeo(node: SectionTreeNode): boolean {
  if (!isPubliclyAccessible(node)) {
    return false;
  }

  if (node.seo?.noindex) {
    return false;
  }

  return true;
}

function findByPath(
  node: SectionTreeNode,
  targetPath: string
): SectionTreeNode | null {
  if (node.path === targetPath) {
    return node;
  }

  for (const child of node.children) {
    const found = findByPath(child, targetPath);

    if (found) {
      return found;
    }
  }

  return null;
}

function buildBreadcrumbs(
  node: SectionTreeNode,
  targetPath: string,
  trail: SectionBreadcrumb[] = []
): SectionBreadcrumb[] | null {
  const nextTrail: SectionBreadcrumb[] = [
    ...trail,
    { id: node.id, title: node.title, path: node.path },
  ];

  if (node.path === targetPath) {
    return nextTrail;
  }

  for (const child of node.children) {
    const result = buildBreadcrumbs(child, targetPath, nextTrail);

    if (result) {
      return result;
    }
  }

  return null;
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Fetch the FULL section tree.
 * Used by:
 * - navigation
 * - admin tree UI
 * - sitemap generation
 */
export async function getSectionTree(): Promise<SectionTreeNode> {
  return deepClone(SECTION_TREE);
}

/**
 * Resolve a public section route from URL segments.
 *
 * Examples:
 * - []            -> "/"
 * - ["projects"]  -> "/projects"
 * - ["ai","ml"]   -> "/ai/ml"
 */
export async function getSectionBySlugPath(
  slugs: string[]
): Promise<SectionRouteData | null> {
  const path = slugsToNormalizedPath(slugs);

  const tree = await getSectionTree();
  const current = findByPath(tree, path);

  if (!current) {
    return null;
  }

  if (!isPubliclyAccessible(current)) {
    return null;
  }

  const breadcrumbs =
    buildBreadcrumbs(tree, path)?.filter((b) => b.path !== "") ?? [];

  return {
    current,
    breadcrumbs,
  };
}

/**
 * Utility to compute canonical path from slugs.
 * Centralized to avoid duplication.
 */
export function slugsToPath(slugs: string[]): string {
  return slugsToNormalizedPath(slugs);
}

/**
 * Helper for sitemap/SEO:
 * Determines if a section should be indexable.
 */
export function isSectionIndexable(node: SectionTreeNode): boolean {
  return isIndexableForSeo(node);
}
