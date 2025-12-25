// services/blog.service.ts

import type { BlogInput, NormalizedBlog } from "@/lib/validation/blog";
import { validateBlogInput } from "@/lib/validation/blog";

/**
 * ⚠️ STAGE 4 NOTE
 * Placeholder blog service (DEV ONLY).
 *
 * - Keeps in-memory data for local development
 * - Uses lib/validation/blog for normalization + safety
 * - Later, replace internals with Supabase without changing callers
 *
 * ✅ This file is an adapter layer (thin service)
 * ✅ Validation/normalization comes from lib/validation/*
 * ❌ Do not duplicate schema logic here
 */

/* -------------------------------------------------------------------------- */
/* In-memory storage (DEV ONLY)                                               */
/* -------------------------------------------------------------------------- */

const BLOGS: NormalizedBlog[] = [
  {
    id: "1",
    title: "Getting Started with AI 3D Portfolios",
    slug: "ai-3d-portfolios",
    excerpt: "A quick intro blog placeholder about AI + 3D portfolios.",
    content: "# Welcome\nThis is a placeholder blog content...",
    coverImageUrl: null,
    tags: ["ai", "portfolio", "3d"],
    status: "published",
    publishedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    readingTimeMinutes: null,
    seoTitle: null,
    seoDescription: null,
  },
  {
    id: "2",
    title: "How to Structure Sections Dynamically",
    slug: "dynamic-sections-structure",
    excerpt: "Placeholder post explaining a dynamic sections engine concept.",
    content: "# Sections\nThis is a placeholder for section structure...",
    coverImageUrl: null,
    tags: ["cms", "sections", "nextjs"],
    status: "published",
    publishedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    readingTimeMinutes: null,
    seoTitle: null,
    seoDescription: null,
  },
];

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function nowIso(): string {
  return new Date().toISOString();
}

function isPublishedAndVisible(blog: NormalizedBlog): boolean {
  return blog.status === "published";
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Fetch all published blogs.
 *
 * NOTE:
 * - Your previous version used "sectionId" + "visible/published".
 * - In the new normalized model, "status" drives visibility (published vs draft/archived).
 * - If you later re-introduce sections/folders, filter can be done in CMS layer.
 */
export async function getPublishedBlogs(): Promise<NormalizedBlog[]> {
  return deepClone(BLOGS.filter(isPublishedAndVisible));
}

/**
 * Fetch a single published blog by slug.
 */
export async function getPublishedBlogBySlug(
  slug: string
): Promise<NormalizedBlog | null> {
  const s = slug.trim().toLowerCase();

  const blog = BLOGS.find((b) => b.slug === s && isPublishedAndVisible(b));

  return blog ? deepClone(blog) : null;
}

/**
 * Create a blog (DEV ONLY).
 * Validates + normalizes via lib/validation/blog.
 */
export async function createBlog(
  payload: BlogInput
): Promise<NormalizedBlog> {
  const result = validateBlogInput(payload, {});

  if (!result.ok) {
    const message = Object.values(result.errors).filter(Boolean).join(" ");
    throw new Error(message || "Invalid blog payload.");
  }

  const created: NormalizedBlog = {
    ...result.data,
    id: crypto.randomUUID(),
    updatedAt: nowIso(),
    publishedAt:
      result.data.status === "published"
        ? result.data.publishedAt ?? nowIso()
        : null,
  };

  BLOGS.unshift(created);

  return deepClone(created);
}

/**
 * Update a blog by id (DEV ONLY).
 * Validates + normalizes via lib/validation/blog.
 */
export async function updateBlog(
  id: string,
  payload: Partial<BlogInput>
): Promise<NormalizedBlog> {
  const idx = BLOGS.findIndex((b) => b.id === id);

  if (idx === -1) {
    throw new Error("Blog not found.");
  }

  const merged: BlogInput = {
    ...BLOGS[idx],
    ...payload,
    id,
  };

  const result = validateBlogInput(merged, {});

  if (!result.ok) {
    const message = Object.values(result.errors).filter(Boolean).join(" ");
    throw new Error(message || "Invalid blog payload.");
  }

  const updated: NormalizedBlog = {
    ...result.data,
    id,
    updatedAt: nowIso(),
    publishedAt:
      result.data.status === "published"
        ? result.data.publishedAt ?? BLOGS[idx].publishedAt ?? nowIso()
        : null,
  };

  BLOGS[idx] = updated;

  return deepClone(updated);
}

/**
 * Delete a blog by id (DEV ONLY).
 */
export async function deleteBlog(id: string): Promise<void> {
  const idx = BLOGS.findIndex((b) => b.id === id);

  if (idx === -1) {
    return;
  }

  BLOGS.splice(idx, 1);
}

/**
 * Check if a blog should be indexable for SEO/sitemap.
 */
export function isBlogIndexable(blog: NormalizedBlog): boolean {
  return blog.status === "published";
}
