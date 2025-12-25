// hooks/useAnalytics.ts
import { useEffect } from "react";

/**
 * Custom hook to track analytics events in the frontend.
 * Placeholder implementation: can later send data to your analytics API.
 *
 * Usage:
 * const { trackPageView, trackEvent } = useAnalytics();
 */

export function useAnalytics() {
  /**
   * Track a page view
   * @param page - The page path
   */
  const trackPageView = (page: string) => {
    console.log(`[Analytics] Page View: ${page}`);
    // TODO: Replace with API call to backend analytics endpoint
  };

  /**
   * Track a custom event
   * @param eventName - Event name
   * @param data - Optional payload
   */
  const trackEvent = (eventName: string, data?: Record<string, any>) => {
    console.log(`[Analytics] Event: ${eventName}`, data);
    // TODO: Replace with API call to backend analytics endpoint
  };

  // Optional: track initial page view on mount
  useEffect(() => {
    trackPageView(window.location.pathname);
  }, []);

  return { trackPageView, trackEvent };
}
