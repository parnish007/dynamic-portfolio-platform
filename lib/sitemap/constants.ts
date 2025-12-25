// ============================================
// Sitemap Change Frequencies
// ============================================

export const SITEMAP_CHANGEFREQ = {
  always: "always",
  hourly: "hourly",
  daily: "daily",
  weekly: "weekly",
  monthly: "monthly",
  yearly: "yearly",
  never: "never",
} as const;

export type SitemapChangeFreq =
  typeof SITEMAP_CHANGEFREQ[keyof typeof SITEMAP_CHANGEFREQ];


// ============================================
// Sitemap Priorities
// ============================================

export const SITEMAP_PRIORITY = {
  highest: 1.0,
  high: 0.9,
  medium: 0.7,
  low: 0.5,
  lowest: 0.3,
} as const;

export type SitemapPriority =
  typeof SITEMAP_PRIORITY[keyof typeof SITEMAP_PRIORITY];


// ============================================
// Default Sitemap Rules
// ============================================

export const DEFAULT_SITEMAP_RULES = {
  home: {
    changeFrequency: SITEMAP_CHANGEFREQ.weekly,
    priority: SITEMAP_PRIORITY.highest,
  },

  projects: {
    changeFrequency: SITEMAP_CHANGEFREQ.weekly,
    priority: SITEMAP_PRIORITY.high,
  },

  blogs: {
    changeFrequency: SITEMAP_CHANGEFREQ.weekly,
    priority: SITEMAP_PRIORITY.high,
  },

  contact: {
    changeFrequency: SITEMAP_CHANGEFREQ.monthly,
    priority: SITEMAP_PRIORITY.low,
  },

  resume: {
    changeFrequency: SITEMAP_CHANGEFREQ.monthly,
    priority: SITEMAP_PRIORITY.low,
  },
};


// ============================================
// Sitemap Exclusions
// ============================================

export const SITEMAP_EXCLUDE_PATHS = [
  "/admin",
  "/admin/login",
  "/admin/dashboard",
  "/admin/content",
  "/admin/chat",
  "/admin/chatbot",
  "/admin/settings",
] as const;


// ============================================
// Sitemap Defaults
// ============================================

export const SITEMAP_DEFAULTS = {
  changeFrequency: SITEMAP_CHANGEFREQ.monthly,
  priority: SITEMAP_PRIORITY.medium,
};
