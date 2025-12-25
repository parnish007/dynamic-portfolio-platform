// C:\Users\AB\Desktop\portfolio-website\lib\validation\blog.ts

import { slugify } from "@/lib/utils/slugify";
import {
  isNonEmptyString,
  isPlainObject,
  isValidISODateString,
} from "@/lib/utils/validation";

export type BlogStatus = "draft" | "published" | "archived";

export type BlogInput = {
  id?: string;
  title: string;
  slug?: string;
  excerpt?: string;
  content: string;
  coverImageUrl?: string;
  tags?: string[];
  status?: BlogStatus;
  publishedAt?: string | null;
  updatedAt?: string | null;
  readingTimeMinutes?: number | null;
  seoTitle?: string;
  seoDescription?: string;
};

export type NormalizedBlog = {
  id?: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImageUrl: string | null;
  tags: string[];
  status: BlogStatus;
  publishedAt: string | null;
  updatedAt: string | null;
  readingTimeMinutes: number | null;
  seoTitle: string | null;
  seoDescription: string | null;
};

export type BlogValidationErrors = Partial<Record<keyof BlogInput, string>>;

export type BlogValidationResult =
  | { ok: true; data: NormalizedBlog }
  | { ok: false; errors: BlogValidationErrors };

export type ValidateBlogOptions = {
  nowIso?: string;
  maxTitleLength?: number;
  maxSlugLength?: number;
  maxExcerptLength?: number;
  maxSeoTitleLength?: number;
  maxSeoDescriptionLength?: number;
  maxTags?: number;
  maxTagLength?: number;
  requireExcerpt?: boolean;
};

const DEFAULTS: Required<Omit<ValidateBlogOptions, "nowIso">> = {
  maxTitleLength: 140,
  maxSlugLength: 180,
  maxExcerptLength: 320,
  maxSeoTitleLength: 70,
  maxSeoDescriptionLength: 160,
  maxTags: 12,
  maxTagLength: 32,
  requireExcerpt: false,
};

function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeTags(tags: string[], maxTagLength: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const raw of tags) {
    if (typeof raw !== "string") {
      continue;
    }

    const cleaned = normalizeWhitespace(raw).toLowerCase();

    if (!cleaned) {
      continue;
    }

    const clipped = cleaned.slice(0, maxTagLength);

    if (seen.has(clipped)) {
      continue;
    }

    seen.add(clipped);
    out.push(clipped);
  }

  return out;
}

function isAllowedStatus(value: unknown): value is BlogStatus {
  return value === "draft" || value === "published" || value === "archived";
}

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  const n = Math.floor(value);

  if (n < min) {
    return min;
  }

  if (n > max) {
    return max;
  }

  return n;
}

function toNullableIso(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  if (!isValidISODateString(trimmed)) {
    return null;
  }

  return trimmed;
}

function safeString(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return value;
}

export function validateBlogInput(
  input: unknown,
  options?: ValidateBlogOptions
): BlogValidationResult {
  const opts: Required<Omit<ValidateBlogOptions, "nowIso">> = {
    ...DEFAULTS,
    ...(options ?? {}),
  };

  if (!isPlainObject(input)) {
    return {
      ok: false,
      errors: {
        title: "Invalid payload.",
        content: "Invalid payload.",
      },
    };
  }

  const maybe = input as Partial<BlogInput>;

  const titleRaw = safeString(maybe.title);
  const contentRaw = safeString(maybe.content);

  const title = normalizeWhitespace(titleRaw);
  const content = contentRaw;

  const errors: BlogValidationErrors = {};

  if (!isNonEmptyString(title)) {
    errors.title = "Title is required.";
  } else if (title.length > opts.maxTitleLength) {
    errors.title = `Title must be at most ${opts.maxTitleLength} characters.`;
  }

  if (!isNonEmptyString(content)) {
    errors.content = "Content is required.";
  }

  const slugInput = normalizeWhitespace(safeString(maybe.slug));
  const derivedSlug = slugify(title);
  const slug = (slugInput ? slugify(slugInput) : derivedSlug).slice(
    0,
    opts.maxSlugLength
  );

  if (!isNonEmptyString(slug)) {
    errors.slug = "Slug is required (and could not be derived from title).";
  } else if (slug.length > opts.maxSlugLength) {
    errors.slug = `Slug must be at most ${opts.maxSlugLength} characters.`;
  }

  const excerptRaw = normalizeWhitespace(safeString(maybe.excerpt));
  const excerpt = excerptRaw;

  if (opts.requireExcerpt && !isNonEmptyString(excerpt)) {
    errors.excerpt = "Excerpt is required.";
  } else if (excerpt && excerpt.length > opts.maxExcerptLength) {
    errors.excerpt = `Excerpt must be at most ${opts.maxExcerptLength} characters.`;
  }

  const coverImageUrlRaw = normalizeWhitespace(safeString(maybe.coverImageUrl));
  const coverImageUrl = coverImageUrlRaw ? coverImageUrlRaw : null;

  const tagsInput = Array.isArray(maybe.tags) ? maybe.tags : [];
  const tags = normalizeTags(tagsInput as unknown as string[], opts.maxTagLength);

  if (tags.length > opts.maxTags) {
    errors.tags = `You can add at most ${opts.maxTags} tags.`;
  }

  const status: BlogStatus = isAllowedStatus(maybe.status)
    ? maybe.status
    : "draft";

  const publishedAt = toNullableIso(maybe.publishedAt);

  if (status === "published" && publishedAt === null) {
    errors.publishedAt = "publishedAt is required when status is published.";
  }

  const updatedAt = toNullableIso(maybe.updatedAt);

  const readingTimeMinutesRaw = maybe.readingTimeMinutes;

  let readingTimeMinutes: number | null = null;

  if (readingTimeMinutesRaw !== null && readingTimeMinutesRaw !== undefined) {
    if (typeof readingTimeMinutesRaw !== "number") {
      errors.readingTimeMinutes = "readingTimeMinutes must be a number.";
    } else {
      readingTimeMinutes = clampInt(readingTimeMinutesRaw, 1, 180);
    }
  }

  const seoTitleRaw = normalizeWhitespace(safeString(maybe.seoTitle));
  const seoDescriptionRaw = normalizeWhitespace(safeString(maybe.seoDescription));

  const seoTitle = seoTitleRaw ? seoTitleRaw : null;
  const seoDescription = seoDescriptionRaw ? seoDescriptionRaw : null;

  if (seoTitle && seoTitle.length > opts.maxSeoTitleLength) {
    errors.seoTitle = `seoTitle must be at most ${opts.maxSeoTitleLength} characters.`;
  }

  if (seoDescription && seoDescription.length > opts.maxSeoDescriptionLength) {
    errors.seoDescription = `seoDescription must be at most ${opts.maxSeoDescriptionLength} characters.`;
  }

  const id = typeof maybe.id === "string" && maybe.id.trim() ? maybe.id : undefined;

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  const normalized: NormalizedBlog = {
    id,
    title,
    slug,
    excerpt,
    content,
    coverImageUrl,
    tags,
    status,
    publishedAt,
    updatedAt,
    readingTimeMinutes,
    seoTitle,
    seoDescription,
  };

  return { ok: true, data: normalized };
}
