// ============================================
// Imports
// ============================================

import type { Metadata } from "next";

import { APP_CONFIG, SEO_CONFIG } from "@/lib/config/app";


// ============================================
// Types
// ============================================

export type TwitterCardType =
  | "summary"
  | "summary_large_image"
  | "player"
  | "app";

export type TwitterInput = {
  title: string;
  description: string;

  image?: string;

  card?: TwitterCardType;

  creator?: string;
  site?: string;
};


// ============================================
// Helpers
// ============================================

const absoluteUrl = (
  pathOrUrl: string
) => {

  if (pathOrUrl.startsWith("http")) return pathOrUrl;

  const base = APP_CONFIG.url.endsWith("/")
    ? APP_CONFIG.url.slice(0, -1)
    : APP_CONFIG.url;

  const cleanPath = pathOrUrl.startsWith("/")
    ? pathOrUrl
    : `/${pathOrUrl}`;

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
// Twitter Metadata Builder
// ============================================

export const buildTwitterMetadata = (
  input: TwitterInput
): NonNullable<Metadata["twitter"]> => {

  const image = resolveImage(input.image);

  return {
    card: input.card ?? "summary_large_image",

    title: input.title,
    description: input.description,

    images: [image],

    creator: input.creator,
    site: input.site,
  };
};


// ============================================
// Convenience Presets
// ============================================

export const defaultTwitterMetadata = (
  title: string,
  description: string,
  image?: string
) => {

  return buildTwitterMetadata({
    title,
    description,
    image,
    card: "summary_large_image",
  });
};
