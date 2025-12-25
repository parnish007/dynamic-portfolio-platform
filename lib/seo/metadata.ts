// ============================================
// Imports
// ============================================

import type { Metadata } from "next";

import { APP_CONFIG, SEO_CONFIG } from "@/lib/config/app";

import { ROUTES } from "@/lib/config/routes";


// ============================================
// Types
// ============================================

export type MetadataInput = {
  title?: string;
  description?: string;

  path?: string;

  image?: string;

  noIndex?: boolean;

  keywords?: string[];

  // Comment
  // Optional content identifiers for consistent OG + canonical building.

  blogSlug?: string;
  projectSlug?: string;
  sectionSlug?: string;
};


// ============================================
// Helpers
// ============================================

const absoluteUrl = (
  path: string
) => {

  const base = APP_CONFIG.url;

  const cleanBase = base.endsWith("/") ? base.slice(0, -1) : base;

  const cleanPath = path.startsWith("/") ? path : `/${path}`;

  return `${cleanBase}${cleanPath}`;
};

const resolvePath = (
  input?: MetadataInput
) => {

  if (input?.path) return input.path;

  if (input?.blogSlug) return ROUTES.public.blog(input.blogSlug);

  if (input?.projectSlug) return ROUTES.public.project(input.projectSlug);

  if (input?.sectionSlug) return ROUTES.public.section(input.sectionSlug);

  return ROUTES.public.home;
};

const resolveTitle = (
  input?: MetadataInput
) => {

  const raw = input?.title?.trim();

  if (raw && raw.length > 0) {
    return SEO_CONFIG.titleTemplate.replace("%s", raw);
  }

  return SEO_CONFIG.defaultTitle;
};

const resolveDescription = (
  input?: MetadataInput
) => {

  const raw = input?.description?.trim();

  if (raw && raw.length > 0) return raw;

  return SEO_CONFIG.description;
};

const resolveImage = (
  input?: MetadataInput
) => {

  const image = input?.image?.trim();

  if (image && image.length > 0) {
    return image.startsWith("http")
      ? image
      : absoluteUrl(image);
  }

  return absoluteUrl(SEO_CONFIG.ogImage);
};


// ============================================
// Public: Create Metadata
// ============================================

export const createMetadata = (
  input?: MetadataInput
): Metadata => {

  const path = resolvePath(input);

  const title = resolveTitle(input);

  const description = resolveDescription(input);

  const canonical = absoluteUrl(path);

  const image = resolveImage(input);

  const noIndex = Boolean(input?.noIndex);

  const keywords = input?.keywords ?? [];

  return {
    title,
    description,

    metadataBase: new URL(APP_CONFIG.url),

    alternates: {
      canonical,
    },

    robots: noIndex
      ? { index: false, follow: false }
      : { index: true, follow: true },

    applicationName: APP_CONFIG.name,

    openGraph: {
      type: "website",
      siteName: APP_CONFIG.name,

      title,
      description,

      url: canonical,

      images: [
        {
          url: image,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],

      locale: APP_CONFIG.locale,
    },

    twitter: {
      card: "summary_large_image",

      title,
      description,

      images: [image],
    },

    keywords: keywords.length > 0
      ? keywords
      : undefined,
  };
};


// ============================================
// Convenience Builders
// ============================================

export const createBlogMetadata = (
  blogSlug: string,
  input?: Omit<MetadataInput, "blogSlug" | "path">
) => {

  return createMetadata({
    ...input,
    blogSlug,
  });
};

export const createProjectMetadata = (
  projectSlug: string,
  input?: Omit<MetadataInput, "projectSlug" | "path">
) => {

  return createMetadata({
    ...input,
    projectSlug,
  });
};

export const createSectionMetadata = (
  sectionSlug: string,
  input?: Omit<MetadataInput, "sectionSlug" | "path">
) => {

  return createMetadata({
    ...input,
    sectionSlug,
  });
};


// ============================================
// Admin Metadata (No Index)
// ============================================

export const createAdminMetadata = (
  title?: string
) => {

  return createMetadata({
    title: title ? `${title} (Admin)` : "Admin",
    description: "Admin area",
    path: "/admin",
    noIndex: true,
  });
};
