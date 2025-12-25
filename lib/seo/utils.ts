// ============================================
// Imports
// ============================================

import { APP_CONFIG, SEO_CONFIG } from "@/lib/config/app";


// ============================================
// URL Helpers
// ============================================

export const normalizeBaseUrl = (
  url: string
) => {

  if (!url) return "http://localhost:3000";

  return url.endsWith("/")
    ? url.slice(0, -1)
    : url;
};

export const normalizePath = (
  path: string
) => {

  if (!path) return "/";

  return path.startsWith("/")
    ? path
    : `/${path}`;
};

export const absoluteUrl = (
  pathOrUrl: string
) => {

  if (!pathOrUrl) return normalizeBaseUrl(APP_CONFIG.url);

  if (pathOrUrl.startsWith("http")) return pathOrUrl;

  const base = normalizeBaseUrl(APP_CONFIG.url);

  const path = normalizePath(pathOrUrl);

  return `${base}${path}`;
};


// ============================================
// Text Helpers
// ============================================

export const safeTrim = (
  value?: string | null
) => {
  return (value ?? "").trim();
};

export const truncate = (
  input: string,
  maxLength: number
) => {

  if (!input) return "";

  const safeMax = Math.max(10, Math.min(maxLength, 5000));

  if (input.length <= safeMax) return input;

  return input.slice(0, safeMax).trimEnd() + "…";
};


// ============================================
// SEO Defaults
// ============================================

export const resolveSeoTitle = (
  title?: string
) => {

  const raw = safeTrim(title);

  if (raw) {
    return SEO_CONFIG.titleTemplate.replace("%s", raw);
  }

  return SEO_CONFIG.defaultTitle;
};

export const resolveSeoDescription = (
  description?: string
) => {

  const raw = safeTrim(description);

  if (raw) return raw;

  return SEO_CONFIG.description;
};

export const resolveSeoImage = (
  image?: string
) => {

  const raw = safeTrim(image);

  if (raw) return absoluteUrl(raw);

  return absoluteUrl(SEO_CONFIG.ogImage);
};


// ============================================
// Robots Helpers
// ============================================

export const isNoIndexPath = (
  pathname: string
) => {

  if (!pathname) return false;

  if (pathname.startsWith("/admin")) return true;

  return false;
};


// ============================================
// Canonical Helpers
// ============================================

export const canonicalUrlForPath = (
  pathname: string
) => {
  return absoluteUrl(normalizePath(pathname));
};
