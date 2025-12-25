// ============================================
// Imports
// ============================================

import type { Metadata } from "next";

import { APP_CONFIG, SEO_CONFIG } from "@/lib/config/app";


// ============================================
// Types
// ============================================

export type OpenGraphInput = {
  title: string;
  description: string;
  url: string;

  image?: string;

  type?: "website" | "article";

  publishedTime?: string;
  modifiedTime?: string;

  authors?: string[];
  tags?: string[];

  locale?: string;
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

  if (path.startsWith("http")) return path;

  const cleanPath = path.startsWith("/")
    ? path
    : `/${path}`;

  return `${base}${cleanPath}`;
};

const resolveImage = (
  image?: string
) => {

  if (image && image.trim().length > 0) {
    return absoluteUrl(image);
  }

  return absoluteUrl(SEO_CONFIG.ogImage);
};


// ============================================
// Open Graph Builder
// ============================================

export const buildOpenGraph = (
  input: OpenGraphInput
): NonNullable<Metadata["openGraph"]> => {

  const image = resolveImage(input.image);

  return {
    type: input.type ?? "website",

    siteName: APP_CONFIG.name,

    title: input.title,
    description: input.description,

    url: absoluteUrl(input.url),

    locale: input.locale ?? APP_CONFIG.locale,

    images: [
      {
        url: image,
        width: 1200,
        height: 630,
        alt: input.title,
      },
    ],

    ...(input.type === "article" && {
      publishedTime: input.publishedTime,
      modifiedTime: input.modifiedTime,
      authors: input.authors,
      tags: input.tags,
    }),
  };
};


// ============================================
// Twitter Card Builder
// ============================================

export const buildTwitterCard = (
  input: {
    title: string;
    description: string;
    image?: string;
  }
): NonNullable<Metadata["twitter"]> => {

  const image = resolveImage(input.image);

  return {
    card: "summary_large_image",

    title: input.title,
    description: input.description,

    images: [image],
  };
};
