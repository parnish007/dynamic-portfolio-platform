import type { BaseItem } from "@/types/item";
import type { SeoMeta } from "@/types/seo";

/**
 * External link for a project.
 * Examples:
 * - Live Demo
 * - GitHub Repo
 * - Case Study
 * - Docs
 */
export type ProjectLink = {
  label: string;
  url: string;
};

/**
 * Media attached to a project.
 * Stored in Supabase Storage later.
 */
export type ProjectMedia = {
  url: string;
  type: "image" | "video";
  alt?: string;
};

/**
 * Case study structure (admin-controlled).
 * If caseStudyEnabled is false, frontend must hide this block.
 */
export type ProjectCaseStudy = {
  problem: string;
  constraints: string;
  data: string;
  experiments: string;
  results: string;
  learnings: string;
};

/**
 * Project = "file" living inside a section folder.
 * - sectionId connects project to folder
 * - published + visible enforce SEO + sitemap rules later
 * - views included for popularity ranking and analytics
 */
export type Project = BaseItem & {
  type: "project";

  sectionId: string;

  title: string;
  slug: string;

  summary: string;

  techStack: string[];

  links: ProjectLink[];

  media: ProjectMedia[];

  caseStudyEnabled: boolean;
  caseStudy: ProjectCaseStudy;

  /**
   * View count is tracked server-side later.
   * Included here so UI is "view-count ready".
   */
  views: number;

  /**
   * SEO metadata for the project detail page.
   * Must be editable, but safe defaults can be generated.
   */
  seo?: SeoMeta;
};
