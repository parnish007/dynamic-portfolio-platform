// ============================================
// Imports
// ============================================

import type { MetadataRoute } from "next";


// ============================================
// Core Sitemap Types
// ============================================

export type SitemapChangeFrequency =
  | "always"
  | "hourly"
  | "daily"
  | "weekly"
  | "monthly"
  | "yearly"
  | "never";

export type SitemapPriority =
  | 0
  | 0.1
  | 0.2
  | 0.3
  | 0.4
  | 0.5
  | 0.6
  | 0.7
  | 0.8
  | 0.9
  | 1;


// ============================================
// Input Types (Before Normalization)
// ============================================

export type SitemapItemInput = {
  path: string;

  lastModified?: string | Date;

  changeFrequency?: SitemapChangeFrequency;

  priority?: number;
};


// ============================================
// Normalized Sitemap Item
// ============================================

export type NormalizedSitemapItem = {
  url: string;

  lastModified?: Date;

  changeFrequency?: MetadataRoute.Sitemap[number]["changeFrequency"];

  priority?: number;
};


// ============================================
// Dynamic Content Inputs
// ============================================

export type BlogSitemapInput = {
  slug: string;
  updatedAt?: string | Date;
};

export type ProjectSitemapInput = {
  slug: string;
  updatedAt?: string | Date;
};

export type SectionSitemapInput = {
  slug: string;
  updatedAt?: string | Date;
};


// ============================================
// Sitemap Generation Input
// ============================================

export type SitemapGenerateInput = {
  blogs?: BlogSitemapInput[];
  projects?: ProjectSitemapInput[];
  sections?: SectionSitemapInput[];
};


// ============================================
// Sitemap Build Options
// ============================================

export type SitemapBuildOptions = {
  includeAdmin?: boolean;
};


// ============================================
// Utility Result Types
// ============================================

export type DedupeResult<T> = {
  items: T[];
  removed: number;
};
