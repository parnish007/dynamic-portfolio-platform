// ============================================
// Environment
// ============================================

export type Environment =
  | "development"
  | "production"
  | "test";


// ============================================
// App Meta
// ============================================

export type AppMetaConfig = {
  name: string;
  description: string;
  url: string;
  locale: string;
  timezone: string;
};


// ============================================
// Feature Flags
// ============================================

export type FeatureFlags<T extends string = string> = Record<T, boolean>;


// ============================================
// Route Types
// ============================================

export type StaticRoute = string;

export type DynamicRoute<T extends any[] = any[]> =
  (...params: T) => string;


// ============================================
// Route Registry Shapes
// ============================================

export type PublicRoutes = {
  home: StaticRoute;
  contact: StaticRoute;
  resume: StaticRoute;

  blogs: StaticRoute;
  blog: DynamicRoute<[slug: string]>;

  projects: StaticRoute;
  project: DynamicRoute<[slug: string]>;

  section: DynamicRoute<[slug: string]>;
};

export type AdminRoutes = {
  root: StaticRoute;
  login: StaticRoute;
  dashboard: StaticRoute;

  content: StaticRoute;
  contentTree: StaticRoute;

  blogs: StaticRoute;
  blogEdit: DynamicRoute<[id: string]>;

  chatbot: StaticRoute;
  chat: StaticRoute;

  settings: StaticRoute;
};

export type ApiAuthRoutes = {
  login: StaticRoute;
  logout: StaticRoute;
  me: StaticRoute;
};

export type ApiAnalyticsRoutes = {
  event: StaticRoute;
  summary: StaticRoute;
};

export type ApiAiRoutes = {
  blogDraft: StaticRoute;
  embeddings: StaticRoute;
  readme: StaticRoute;
};

export type ApiRoutes = {
  auth: ApiAuthRoutes;
  analytics: ApiAnalyticsRoutes;
  ai: ApiAiRoutes;
};

export type AppRoutes = {
  public: PublicRoutes;
  admin: AdminRoutes;
  api: ApiRoutes;
};


// ============================================
// Navigation
// ============================================

export type NavigationItem = {
  label: string;
  href: string;
  icon?: string;
  external?: boolean;
  children?: NavigationItem[];
};


// ============================================
// SEO
// ============================================

export type SeoConfig = {
  defaultTitle: string;
  titleTemplate: string;
  description: string;
  ogImage: string;
};


// ============================================
// UI Config
// ============================================

export type UIConfig = {
  theme: "light" | "dark";
  enable3D: boolean;
  motion: boolean;
  breakpoints: {
    mobile: number;
    tablet: number;
  };
};
