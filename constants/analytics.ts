/**
 * Centralized analytics event names.
 *
 * Design goals:
 * - Single source of truth (frontend + backend + admin)
 * - Type-safe usage across the codebase
 * - Stable string values (do NOT change once in production)
 * - Future-proof for dashboards & funnels
 */

export const ANALYTICS_EVENTS = {
  // ---------------------------------------------
  // Core navigation
  // ---------------------------------------------
  PAGE_VIEW: "page_view",

  // ---------------------------------------------
  // Content engagement
  // ---------------------------------------------
  PROJECT_VIEW: "project_view",
  BLOG_VIEW: "blog_view",

  // ---------------------------------------------
  // AI & Chat
  // ---------------------------------------------
  CHATBOT_INTERACTION: "chatbot_interaction",
  LIVECHAT_MESSAGE: "livechat_message",

  // ---------------------------------------------
  // Conversions
  // ---------------------------------------------
  CONTACT_SUBMISSION: "contact_submission",
  RESUME_DOWNLOAD: "resume_download",
} as const;

/**
 * Union type of all analytics event names.
 * Use this everywhere instead of `string`.
 */
export type AnalyticsEventName =
  (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];
