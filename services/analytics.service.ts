// services/analytics.service.ts

import type { AnalyticsEvent } from "@/lib/analytics/types";

/**
 * ⚠️ STAGE 8 NOTE
 * This is a TEMPORARY analytics service adapter.
 *
 * - Uses in-memory storage for development
 * - Acts as a bridge between UI / API routes and lib/analytics/*
 * - Will be replaced by Supabase-backed implementation later
 *
 * ❗ DO NOT put business logic here
 * ❗ lib/analytics/* is the source of truth
 */

/* -------------------------------------------------------------------------- */
/* In-memory storage (DEV ONLY)                                                */
/* -------------------------------------------------------------------------- */

const EVENTS: AnalyticsEvent[] = [];

/* -------------------------------------------------------------------------- */
/* Utilities                                                                  */
/* -------------------------------------------------------------------------- */

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function withTimestamp(event: AnalyticsEvent): AnalyticsEvent {
  return {
    ...event,
    timestamp: event.timestamp ?? new Date().toISOString(),
  };
}

/* -------------------------------------------------------------------------- */
/* Public Service API                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Log a new analytics event.
 *
 * This function is intentionally thin.
 * Validation, normalization, and typing live in lib/analytics/*
 */
export async function logEvent(event: AnalyticsEvent): Promise<void> {
  EVENTS.push(withTimestamp(event));
}

/**
 * Fetch all events.
 *
 * Used for:
 * - Admin dashboard (DEV)
 * - Debugging
 */
export async function getAllEvents(): Promise<AnalyticsEvent[]> {
  return deepClone(EVENTS);
}

/**
 * Get event counts grouped by event type.
 *
 * Example output:
 * {
 *   page_view: 120,
 *   project_view: 34,
 *   blog_view: 18
 * }
 */
export async function getEventCounts(): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};

  for (const event of EVENTS) {
    counts[event.type] = (counts[event.type] ?? 0) + 1;
  }

  return counts;
}

/**
 * Clear all events (DEV ONLY).
 * Useful for local testing and admin reset buttons.
 */
export async function clearEvents(): Promise<void> {
  EVENTS.length = 0;
}
