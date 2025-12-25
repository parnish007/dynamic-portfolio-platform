// C:\Users\AB\Desktop\portfolio-website\lib\validation\project.ts

import { slugify } from "@/lib/utils/slugify";
import {
  isNonEmptyString,
  isPlainObject,
  isValidISODateString,
  isValidURL,
} from "@/lib/utils/validation";

/* -------------------------------------------------------------------------- */
/*                                   TYPES                                    */
/* -------------------------------------------------------------------------- */

export type ProjectStatus = "draft" | "published" | "archived";

export type ProjectInput = {
  id?: string;
  title: string;
  slug?: string;
  shortDescription?: string;
  description: string;
  coverImageUrl?: string;
  galleryImages?: string[];
  liveUrl?: string;
  repoUrl?: string;
  techStack?: string[];
  tags?: string[];
  status?: ProjectStatus;
  featured?: boolean;
  startedAt?: string | null;
  completedAt?: string | null;
  seoTitle?: string;
  seoDescription?: string;
};

export type NormalizedProject = {
  id?: string;
  title: string;
  slug: string;
  shortDescription: string | null;
  description: string;
  coverImageUrl: string | null;
  galleryImages: string[];
  liveUrl: string | null;
  repoUrl: string | null;
  techStack: string[];
  tags: string[];
  status: ProjectStatus;
  featured: boolean;
  startedAt: string | null;
  completedAt: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
};

export type ProjectValidationErrors = Partial<
  Record<keyof ProjectInput, string>
>;

export type ProjectValidationResult =
  | { ok: true; data: NormalizedProject }
  | { ok: false; errors: ProjectValidationErrors };

export type ValidateProjectOptions = {
  maxTitleLength?: number;
  maxSlugLength?: number;
  maxShortDescriptionLength?: number;
  maxTechStack?: number;
  maxTags?: number;
  maxTagLength?: number;
  maxGalleryImages?: number;
  maxSeoTitleLength?: number;
  maxSeoDescriptionLength?: number;
};

/* -------------------------------------------------------------------------- */
/*                                  DEFAULTS                                  */
/* -------------------------------------------------------------------------- */

const DEFAULTS: Required<ValidateProjectOptions> = {
  maxTitleLength: 140,
  maxSlugLength: 180,
  maxShortDescriptionLength: 300,
  maxTechStack: 20,
  maxTags: 12,
  maxTagLength: 32,
  maxGalleryImages: 12,
  maxSeoTitleLength: 70,
  maxSeoDescriptionLength: 160,
};

/* -------------------------------------------------------------------------- */
/*                                 HELPERS                                    */
/* -------------------------------------------------------------------------- */

function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function safeString(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return value;
}

function normalizeStringArray(
  input: unknown,
  maxLength: number
): string[] {
  if (!Array.isArray(input)) {
    return [];
  }

  const seen = new Set<string>();
  const out: string[] = [];

  for (const raw of input) {
    if (typeof raw !== "string") {
      continue;
    }

    const cleaned = normalizeWhitespace(raw).toLowerCase();

    if (!cleaned) {
      continue;
    }

    const clipped = cleaned.slice(0, maxLength);

    if (seen.has(clipped)) {
      continue;
    }

    seen.add(clipped);
    out.push(clipped);
  }

  return out;
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

function toNullableUrl(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  if (!isValidURL(trimmed)) {
    return null;
  }

  return trimmed;
}

function isAllowedStatus(value: unknown): value is ProjectStatus {
  return value === "draft" || value === "published" || value === "archived";
}

/* -------------------------------------------------------------------------- */
/*                               MAIN VALIDATOR                                */
/* -------------------------------------------------------------------------- */

export function validateProjectInput(
  input: unknown,
  options?: ValidateProjectOptions
): ProjectValidationResult {
  const opts: Required<ValidateProjectOptions> = {
    ...DEFAULTS,
    ...(options ?? {}),
  };

  if (!isPlainObject(input)) {
    return {
      ok: false,
      errors: {
        title: "Invalid payload.",
        description: "Invalid payload.",
      },
    };
  }

  const maybe = input as Partial<ProjectInput>;

  const title = normalizeWhitespace(safeString(maybe.title));
  const description = safeString(maybe.description);

  const errors: ProjectValidationErrors = {};

  if (!isNonEmptyString(title)) {
    errors.title = "Title is required.";
  } else if (title.length > opts.maxTitleLength) {
    errors.title = `Title must be at most ${opts.maxTitleLength} characters.`;
  }

  if (!isNonEmptyString(description)) {
    errors.description = "Description is required.";
  }

  const slugInput = normalizeWhitespace(safeString(maybe.slug));
  const derivedSlug = slugify(title);
  const slug = (slugInput ? slugify(slugInput) : derivedSlug).slice(
    0,
    opts.maxSlugLength
  );

  if (!isNonEmptyString(slug)) {
    errors.slug = "Slug is required (and could not be derived from title).";
  }

  const shortDescriptionRaw = normalizeWhitespace(
    safeString(maybe.shortDescription)
  );
  const shortDescription = shortDescriptionRaw
    ? shortDescriptionRaw.slice(0, opts.maxShortDescriptionLength)
    : null;

  const coverImageUrl = toNullableUrl(maybe.coverImageUrl);

  if (maybe.coverImageUrl && coverImageUrl === null) {
    errors.coverImageUrl = "coverImageUrl must be a valid URL.";
  }

  const galleryImages = Array.isArray(maybe.galleryImages)
    ? maybe.galleryImages
        .map(toNullableUrl)
        .filter((v): v is string => Boolean(v))
        .slice(0, opts.maxGalleryImages)
    : [];

  if (
    Array.isArray(maybe.galleryImages) &&
    maybe.galleryImages.length > opts.maxGalleryImages
  ) {
    errors.galleryImages = `You can add at most ${opts.maxGalleryImages} gallery images.`;
  }

  const liveUrl = toNullableUrl(maybe.liveUrl);

  if (maybe.liveUrl && liveUrl === null) {
    errors.liveUrl = "liveUrl must be a valid URL.";
  }

  const repoUrl = toNullableUrl(maybe.repoUrl);

  if (maybe.repoUrl && repoUrl === null) {
    errors.repoUrl = "repoUrl must be a valid URL.";
  }

  const techStack = normalizeStringArray(
    maybe.techStack,
    opts.maxTagLength
  ).slice(0, opts.maxTechStack);

  const tags = normalizeStringArray(
    maybe.tags,
    opts.maxTagLength
  ).slice(0, opts.maxTags);

  const status: ProjectStatus = isAllowedStatus(maybe.status)
    ? maybe.status
    : "draft";

  const featured = typeof maybe.featured === "boolean"
    ? maybe.featured
    : false;

  const startedAt = toNullableIso(maybe.startedAt);
  const completedAt = toNullableIso(maybe.completedAt);

  const seoTitleRaw = normalizeWhitespace(safeString(maybe.seoTitle));
  const seoDescriptionRaw = normalizeWhitespace(
    safeString(maybe.seoDescription)
  );

  const seoTitle = seoTitleRaw ? seoTitleRaw : null;
  const seoDescription = seoDescriptionRaw ? seoDescriptionRaw : null;

  if (seoTitle && seoTitle.length > opts.maxSeoTitleLength) {
    errors.seoTitle = `seoTitle must be at most ${opts.maxSeoTitleLength} characters.`;
  }

  if (seoDescription && seoDescription.length > opts.maxSeoDescriptionLength) {
    errors.seoDescription = `seoDescription must be at most ${opts.maxSeoDescriptionLength} characters.`;
  }

  const id =
    typeof maybe.id === "string" && maybe.id.trim()
      ? maybe.id
      : undefined;

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  const normalized: NormalizedProject = {
    id,
    title,
    slug,
    shortDescription,
    description,
    coverImageUrl,
    galleryImages,
    liveUrl,
    repoUrl,
    techStack,
    tags,
    status,
    featured,
    startedAt,
    completedAt,
    seoTitle,
    seoDescription,
  };

  return { ok: true, data: normalized };
}
