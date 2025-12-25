// hooks/useAdminAvailability.ts
import { useEffect, useState } from "react";

/**
 * Tracks admin online/offline status for live chat.
 * Returns `isOnline` boolean and updates in real-time.
 *
 * Placeholder implementation: simulates admin availability.
 * Replace with Supabase Realtime or WebSocket integration later.
 */
export function useAdminAvailability() {
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    // Simulate checking admin availability every 5 seconds
    const checkAdminStatus = () => {
      // TODO: Replace with real API or WebSocket call
      const online = Math.random() > 0.5; // 50% chance online/offline
      setIsOnline(online);
    };

    checkAdminStatus(); // initial check
    const interval = setInterval(checkAdminStatus, 5000);

    return () => clearInterval(interval);
  }, []);

  return { isOnline };
}
