// ============================================
// App Meta Configuration
// ============================================

export const APP_CONFIG = {
  name
  : "Parnish | AI Portfolio",

  description
  : "AI-powered 3D portfolio with dynamic CMS, analytics, and real-time features.",

  url
  : process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",

  locale
  : "en-US",

  timezone
  : "Asia/Kathmandu",
};


// ============================================
// Environment Flags
// ============================================

export const ENV = {
  isDev
  : process.env.NODE_ENV === "development",

  isProd
  : process.env.NODE_ENV === "production",

  isTest
  : process.env.NODE_ENV === "test",
};


// ============================================
// Feature Flags (Toggle Safely)
// ============================================

export const FEATURES = {
  analytics
  : true,

  chatbot
  : true,

  realtimeChat
  : true,

  aiBlogDraft
  : true,

  aiReadme
  : true,

  ragChatbot
  : false, // planned

  adminCMS
  : true,

  experiments
  : false, // planned
};


// ============================================
// Route Configuration
// ============================================

export const ROUTES = {
  public: {
    home: "/",
    projects: "/projects",
    blogs: "/blogs",
    contact: "/contact",
    resume: "/resume",
  },

  admin: {
    login: "/admin/login",
    dashboard: "/admin/dashboard",
    content: "/admin/content",
    blogs: "/admin/blogs",
    chatbot: "/admin/chatbot",
    chat: "/admin/chat",
    settings: "/admin/settings",
  },
};


// ============================================
// Analytics Configuration
// ============================================

export const ANALYTICS_CONFIG = {
  dedupeWindowMs
  : 1500,

  enableDebugInDev
  : true,
};


// ============================================
// SEO Defaults
// ============================================

export const SEO_CONFIG = {
  defaultTitle
  : "Parnish – AI Engineer & Full Stack Developer",

  titleTemplate
  : "%s | Parnish",

  description
  : "Building intelligent, scalable, and visually immersive digital products.",

  ogImage
  : "/og.png",
};


// ============================================
// UI / UX Defaults
// ============================================

export const UI_CONFIG = {
  theme
  : "dark",

  enable3D
  : true,

  motion
  : true,

  breakpoints: {
    mobile: 768,
    tablet: 1024,
  },
};
