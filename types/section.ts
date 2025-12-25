import type { SeoMeta } from "@/types/seo";

export type SectionLayoutPreset = "grid" | "cards" | "list" | "timeline" | "three";
export type SectionOrientation = "vertical" | "horizontal";
export type SectionDensity = "compact" | "normal" | "spacious";

/**
 * Core "folder" entity.
 * - Admin creates an infinite tree (parentId links)
 * - Frontend renders from DB truth (in Stage 2 we use a placeholder source)
 * - `path` is the canonical public route (SEO-safe) reflecting hierarchy
 */
export type Section = {
  id: string;
  parentId: string | null;

  title: string;
  description: string;

  /**
   * Slug of this node only (e.g. "ai-ml").
   * Path is derived/canonical (e.g. "/projects/ai-ml").
   */
  slug: string;

  /**
   * Canonical route reflecting the full hierarchy.
   * Example: "/projects/ai-ml/robotics"
   */
  path: string;

  layoutPreset: SectionLayoutPreset;
  orientation: SectionOrientation;
  density: SectionDensity;

  /**
   * Visibility controls whether it can be rendered publicly.
   * Published controls whether it's indexable and included in sitemap.
   */
  visible: boolean;
  published: boolean;

  /**
   * Decorative 3D toggle (must always have SEO-safe fallback rendering).
   */
  enable3d: boolean;

  /**
   * SEO metadata must be editable but safe by default.
   * noindex should be enforced when NOT (published && visible).
   */
  seo: SeoMeta;

  createdAt: string;
  updatedAt: string;
};

/**
 * A tree node used by the frontend renderer.
 * `children` can be infinite depth.
 */
export type SectionTreeNode = Section & {
  children: SectionTreeNode[];

  /**
   * Counts are optional but useful for UI.
   * In Stage 2 these may be 0 or omitted by placeholder source.
   */
  projectsCount?: number;
  blogsCount?: number;
};

/**
 * Convenience type for breadcrumbs.
 */
export type SectionBreadcrumb = {
  id: string;
  title: string;
  path: string;
};

/**
 * Public page payload for a section route.
 * - `current` is the section represented by the URL
 * - `children` are subfolders
 * - future: can include "files" (projects/blogs/tools) inside current folder
 */
export type SectionRouteData = {
  current: SectionTreeNode;
  breadcrumbs: SectionBreadcrumb[];
};
