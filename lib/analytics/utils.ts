// ============================================
// Imports
// ============================================

import type {
  AnalyticsDeviceType,
  AnalyticsEventPayload,
  AnalyticsStoredEvent,
} from "./types";


// ============================================
// Time Utilities
// ============================================

export const nowISO = () => {
  return new Date().toISOString();
};


// ============================================
// Device Detection (Server + Client Safe)
// ============================================

export const detectDeviceFromUA = (
  userAgent?: string | null
): AnalyticsDeviceType => {

  if (!userAgent) return "desktop";

  const ua = userAgent.toLowerCase();

  if (
    ua.includes("mobile") ||
    ua.includes("iphone") ||
    ua.includes("android")
  ) {
    return "mobile";
  }

  if (
    ua.includes("ipad") ||
    ua.includes("tablet")
  ) {
    return "tablet";
  }

  return "desktop";
};


// ============================================
// Normalize Client Payload (API Safe)
// ============================================

export const normalizeAnalyticsPayload = (
  payload: AnalyticsEventPayload
): AnalyticsStoredEvent => {

  return {
    event: payload.event,

    path: payload.path ?? null,
    referrer: payload.referrer ?? null,

    section: payload.section ?? null,
    projectSlug: payload.projectSlug ?? null,
    blogSlug: payload.blogSlug ?? null,

    device: payload.device ?? null,

    metadata: payload.metadata ?? null,

    createdAt: payload.createdAt ?? nowISO(),
  };
};


// ============================================
// Safe Number Aggregator
// ============================================

export const incrementCounter = (
  current: number | undefined,
  amount = 1
) => {
  return (current ?? 0) + amount;
};


// ============================================
// Group By Utility
// ============================================

export const groupBy = <T, K extends string | number>(
  list: T[],
  keyGetter: (item: T) => K
): Record<K, T[]> => {

  return list.reduce((acc, item) => {

    const key = keyGetter(item);

    if (!acc[key]) {
      acc[key] = [];
    }

    acc[key].push(item);

    return acc;

  }, {} as Record<K, T[]>);
};


// ============================================
// Count By Utility
// ============================================

export const countBy = <T, K extends string | number>(
  list: T[],
  keyGetter: (item: T) => K
): Record<K, number> => {

  return list.reduce((acc, item) => {

    const key = keyGetter(item);

    acc[key] = (acc[key] ?? 0) + 1;

    return acc;

  }, {} as Record<K, number>);
};
