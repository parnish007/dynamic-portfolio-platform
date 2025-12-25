// ============================================
// Event Name Union
// ============================================

export type AnalyticsEventName =
  | "page_view"
  | "section_view"
  | "project_view"
  | "blog_view"
  | "contact_submit"
  | "resume_download"
  | "chat_open"
  | "chat_message"
  | "admin_login"
  | "admin_action";


// ============================================
// Device Type
// ============================================

export type AnalyticsDeviceType =
  | "desktop"
  | "tablet"
  | "mobile";


// ============================================
// Event Payload (Client -> API)
// ============================================

export type AnalyticsEventPayload = {
  event
  : AnalyticsEventName;

  path?
  : string;

  referrer?
  : string;

  section?
  : string;

  projectSlug?
  : string;

  blogSlug?
  : string;

  device?
  : AnalyticsDeviceType;

  metadata?
  : Record<string, any>;

  createdAt?
  : string;
};


// ============================================
// Stored Event Shape (API -> DB / Logs)
// ============================================

export type AnalyticsStoredEvent = {
  id?
  : string;

  event
  : AnalyticsEventName;

  path
  : string | null;

  referrer
  : string | null;

  section
  : string | null;

  projectSlug
  : string | null;

  blogSlug
  : string | null;

  device
  : AnalyticsDeviceType | null;

  metadata
  : Record<string, any> | null;

  createdAt
  : string;

  ip?
  : string | null;

  userAgent?
  : string | null;

  country?
  : string | null;

  city?
  : string | null;
};


// ============================================
// Summary Types (API -> Admin Dashboard)
// ============================================

export type AnalyticsSummaryFilters = {
  from?
  : string;

  to?
  : string;
};

export type AnalyticsSummaryResponse = {
  totals: {
    events: number;
    pageViews: number;
    projectViews: number;
    blogViews: number;
    contactSubmits: number;
    resumeDownloads: number;
    chatOpens: number;
    chatMessages: number;
  };

  topPages: Array<{
    path: string;
    count: number;
  }>;

  topProjects: Array<{
    projectSlug: string;
    count: number;
  }>;

  topBlogs: Array<{
    blogSlug: string;
    count: number;
  }>;

  devices: Array<{
    device: AnalyticsDeviceType;
    count: number;
  }>;

  recentEvents: Array<AnalyticsStoredEvent>;
};
