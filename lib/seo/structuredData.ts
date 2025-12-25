// ============================================
// Imports
// ============================================

import { APP_CONFIG, SEO_CONFIG } from "@/lib/config/app";


// ============================================
// Types
// ============================================

export type JsonLd =
  | Record<string, any>
  | Array<Record<string, any>>;

export type PersonInput = {
  name: string;
  jobTitle?: string;
  description?: string;

  image?: string;

  url?: string;

  sameAs?: string[];

  email?: string;

  location?: string;
};

export type ArticleInput = {
  title: string;
  description: string;

  url: string;

  image?: string;

  datePublished: string;
  dateModified?: string;

  authorName: string;

  tags?: string[];
};

export type ProjectInput = {
  name: string;
  description: string;

  url: string;

  image?: string;

  dateCreated?: string;
  dateModified?: string;

  keywords?: string[];

  codeRepository?: string;
  liveDemoUrl?: string;
};

export type BreadcrumbInput = {
  items: Array<{
    name: string;
    url: string;
  }>;
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
// Core Schemas
// ============================================

export const buildWebsiteJsonLd = (): JsonLd => {

  return {
    "@context": "https://schema.org",
    "@type": "WebSite",

    name: APP_CONFIG.name,

    url: absoluteUrl("/"),

    description: SEO_CONFIG.description,
  };
};

export const buildPersonJsonLd = (
  input: PersonInput
): JsonLd => {

  return {
    "@context": "https://schema.org",
    "@type": "Person",

    name: input.name,

    jobTitle: input.jobTitle,

    description: input.description,

    image: resolveImage(input.image),

    url: absoluteUrl(input.url ?? "/"),

    sameAs: input.sameAs,

    email: input.email,

    homeLocation: input.location
      ? {
          "@type": "Place",
          name: input.location,
        }
      : undefined,
  };
};

export const buildArticleJsonLd = (
  input: ArticleInput
): JsonLd => {

  return {
    "@context": "https://schema.org",
    "@type": "Article",

    headline: input.title,

    description: input.description,

    image: [resolveImage(input.image)],

    mainEntityOfPage: absoluteUrl(input.url),

    datePublished: input.datePublished,

    dateModified: input.dateModified ?? input.datePublished,

    author: {
      "@type": "Person",
      name: input.authorName,
    },

    publisher: {
      "@type": "Organization",
      name: APP_CONFIG.name,
      url: absoluteUrl("/"),
    },

    keywords: input.tags,
  };
};

export const buildProjectJsonLd = (
  input: ProjectInput
): JsonLd => {

  return {
    "@context": "https://schema.org",
    "@type": "CreativeWork",

    name: input.name,

    description: input.description,

    url: absoluteUrl(input.url),

    image: resolveImage(input.image),

    dateCreated: input.dateCreated,

    dateModified: input.dateModified ?? input.dateCreated,

    keywords: input.keywords,

    codeRepository: input.codeRepository,

    sameAs: input.liveDemoUrl,
  };
};

export const buildBreadcrumbJsonLd = (
  input: BreadcrumbInput
): JsonLd => {

  const itemListElement = input.items.map((it, idx) => ({
    "@type": "ListItem",
    position: idx + 1,
    name: it.name,
    item: absoluteUrl(it.url),
  }));

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",

    itemListElement,
  };
};


// ============================================
// Combine Multiple Schemas
// ============================================

export const combineJsonLd = (
  list: JsonLd[]
): JsonLd => {

  const flattened: Record<string, any>[] = [];

  for (const item of list) {

    if (Array.isArray(item)) {
      flattened.push(...item);
      continue;
    }

    flattened.push(item);
  }

  return flattened;
};


// ============================================
// Safe JSON String Builder (for <script>)
// ============================================

export const toJsonLdString = (
  jsonLd: JsonLd
) => {

  // Comment
  // Prevent "</script>" injection issues.
  // Replace "<" with unicode escaped version.

  return JSON.stringify(jsonLd).replace(/</g, "\\u003c");
};
