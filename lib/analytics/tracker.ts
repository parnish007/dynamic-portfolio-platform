"use client";

import {
  AnalyticsEventName,
  AnalyticsEventPayload,
  buildAnalyticsEvent,
  trackEvent,
} from "./events";


// ============================================
// Internal: Dedupe Cache
// ============================================

const recentEventCache = new Map<string, number>();


// ============================================
// Config
// ============================================

const DEFAULT_DEDUPE_WINDOW_MS = 1500;


// ============================================
// Utility: Create a stable event key
// ============================================

const createEventKey = (payload: AnalyticsEventPayload) => {
  const core = {
    event: payload.event,
    path: payload.path ?? "",
    section: payload.section ?? "",
    projectSlug: payload.projectSlug ?? "",
    blogSlug: payload.blogSlug ?? "",
  };

  return JSON.stringify(core);
};


// ============================================
// Utility: Should we send this event?
// ============================================

const shouldSendEvent = (
  key: string,
  windowMs: number
) => {

  const now = Date.now();

  const lastSentAt = recentEventCache.get(key);

  if (!lastSentAt) {
    recentEventCache.set(key, now);
    return true;
  }

  if (now - lastSentAt >= windowMs) {
    recentEventCache.set(key, now);
    return true;
  }

  return false;
};


// ============================================
// Public: Track (Generic)
// ============================================

export type TrackOptions = {
  dedupeWindowMs?
  : number;

  debug?
  : boolean;
};

export const track = async (
  event: AnalyticsEventName,
  data?: Partial<AnalyticsEventPayload>,
  options?: TrackOptions
) => {

  if (typeof window === "undefined") return;

  const payload = buildAnalyticsEvent(event, data);

  const dedupeWindowMs = options?.dedupeWindowMs ?? DEFAULT_DEDUPE_WINDOW_MS;

  const key = createEventKey(payload);

  const okToSend = shouldSendEvent(key, dedupeWindowMs);

  if (!okToSend) return;

  if (options?.debug) {
    console.log("[analytics.track]", payload);
  }

  await trackEvent(payload);
};


// ============================================
// Public: Convenience wrappers
// ============================================

export const trackPageView = async (
  options?: TrackOptions
) => {
  await track("page_view", {}, options);
};

export const trackSectionView = async (
  section: string,
  options?: TrackOptions
) => {
  await track("section_view", { section }, options);
};

export const trackProjectView = async (
  projectSlug: string,
  options?: TrackOptions
) => {
  await track("project_view", { projectSlug }, options);
};

export const trackBlogView = async (
  blogSlug: string,
  options?: TrackOptions
) => {
  await track("blog_view", { blogSlug }, options);
};

export const trackContactSubmit = async (
  metadata?: Record<string, any>,
  options?: TrackOptions
) => {
  await track("contact_submit", { metadata }, options);
};

export const trackResumeDownload = async (
  options?: TrackOptions
) => {
  await track("resume_download", {}, options);
};

export const trackChatOpen = async (
  options?: TrackOptions
) => {
  await track("chat_open", {}, options);
};

export const trackChatMessage = async (
  metadata?: Record<string, any>,
  options?: TrackOptions
) => {
  await track("chat_message", { metadata }, options);
};

export const trackAdminLogin = async (
  options?: TrackOptions
) => {
  await track("admin_login", {}, options);
};

export const trackAdminAction = async (
  metadata: Record<string, any>,
  options?: TrackOptions
) => {
  await track("admin_action", { metadata }, options);
};
