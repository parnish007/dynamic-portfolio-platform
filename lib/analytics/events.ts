// ================================
// Analytics Event Types
// ================================

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


// ================================
// Base Analytics Event Shape
// ================================

export interface AnalyticsEventPayload {
  event
  : AnalyticsEventName;

  path?
  : string;

  section?
  : string;

  projectSlug?
  : string;

  blogSlug?
  : string;

  referrer?
  : string;

  device?
  : "desktop" | "tablet" | "mobile";

  metadata?
  : Record<string, any>;

  createdAt?
  : string;
}


// ================================
// Utility: Detect Device Type
// ================================

export const detectDeviceType = () => {
  if (typeof window === "undefined") return "desktop";

  const width = window.innerWidth;

  if (width < 768) return "mobile";
  if (width < 1024) return "tablet";

  return "desktop";
};


// ================================
// Utility: Build Event Payload
// ================================

export const buildAnalyticsEvent = (
  event
  : AnalyticsEventName,

  data?
  : Partial<AnalyticsEventPayload>
): AnalyticsEventPayload => {

  return {
    event,

    path: typeof window !== "undefined"
      ? window.location.pathname
      : undefined,

    referrer: typeof document !== "undefined"
      ? document.referrer
      : undefined,

    device: detectDeviceType(),

    createdAt: new Date().toISOString(),

    ...data,
  };
};


// ================================
// Client-side Event Sender
// ================================

export const trackEvent = async (
  payload
  : AnalyticsEventPayload
) => {

  try {

    await fetch("/api/analytics/event", {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify(payload),
    });

  } catch (error) {

    console.error("Analytics event failed:", error);
  }
};
