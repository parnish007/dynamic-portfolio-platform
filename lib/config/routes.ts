// ============================================
// Route Constants (Single Source of Truth)
// ============================================

export const ROUTES = {

  // ----------------------------
  // Public Routes
  // ----------------------------

  public: {
    home: "/",
    contact: "/contact",
    resume: "/resume",

    blogs: "/blogs",
    blog: (slug: string) => `/blog/${slug}`,

    projects: "/projects",
    project: (slug: string) => `/project/${slug}`,

    // Comment
    // Generic dynamic section system, if you map sections to a slug page.
    // Example: /about, /skills, /experience, etc.
    section: (slug: string) => `/${slug}`,
  },

  // ----------------------------
  // Admin Routes
  // ----------------------------

  admin: {
    root: "/admin",
    login: "/admin/login",
    dashboard: "/admin/dashboard",

    content: "/admin/content",
    contentTree: "/admin/content/tree",

    blogs: "/admin/blogs",
    blogEdit: (id: string) => `/admin/blogs/edit/${id}`,

    chatbot: "/admin/chatbot",
    chat: "/admin/chat",

    settings: "/admin/settings",
  },

  // ----------------------------
  // API Routes
  // ----------------------------

  api: {
    auth: {
      login: "/api/auth/login",
      logout: "/api/auth/logout",
      me: "/api/auth/me",
    },

    analytics: {
      event: "/api/analytics/event",
      summary: "/api/analytics/summary",
    },

    ai: {
      blogDraft: "/api/ai/blog-draft",
      embeddings: "/api/ai/embeddings",
      readme: "/api/ai/readme",
    },
  },
} as const;


// ============================================
// Route Helpers
// ============================================

export const isAdminPath = (
  pathname: string
) => {
  return pathname.startsWith(ROUTES.admin.root);
};

export const isAuthAdminPath = (
  pathname: string
) => {
  return pathname === ROUTES.admin.login;
};

export const withNextParam = (
  url: string,
  nextPath?: string | null
) => {

  if (!nextPath) return url;

  const base = new URL(url, "http://localhost");

  base.searchParams.set("next", nextPath);

  return base.pathname + base.search;
};


// ============================================
// Public File / Next Internals Ignore List
// ============================================

export const isIgnoredByMiddleware = (
  pathname: string
) => {

  if (pathname.startsWith("/_next")) return true;

  if (pathname.startsWith("/favicon")) return true;

  if (pathname === "/robots.txt") return true;
  if (pathname === "/sitemap.xml") return true;

  const fileExtensionPattern = /\.[a-zA-Z0-9]+$/;

  if (fileExtensionPattern.test(pathname)) return true;

  return false;
};
