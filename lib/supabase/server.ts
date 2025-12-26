// lib/supabase/server.ts

import "server-only";

import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

type CookieToSet = {
  name: string;
  value: string;
  options: CookieOptions;
};

function isProdEnv(): boolean {
  return (process.env.NODE_ENV ?? "").toLowerCase() === "production";
}

export function createSupabaseServerClient() {
  const cookieStore = cookies();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing Supabase env. Required: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }

  return createServerClient(url, anonKey, {
    cookies: {
      // Supabase SSR uses getAll() in Next.js App Router mode
      getAll() {
        return cookieStore.getAll().map((c) => ({
          name: c.name,
          value: c.value,
        }));
      },

      // Supabase SSR uses setAll() to refresh session cookies
      setAll(cookiesToSet: CookieToSet[]) {
        try {
          const isProd = isProdEnv();

          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, {
              ...options,

              // ✅ Ensure cookies are available site-wide
              path: options?.path ?? "/",

              // ✅ CRITICAL: secure cookies do NOT work on http://localhost
              // In production (https), keep secure behavior.
              secure: isProd ? (options as any)?.secure ?? true : false,
            });
          });
        } catch (err) {
          // In some contexts (certain server components), cookie writes are not allowed.
          // Route handlers & server actions should still be fine.
          if (!isProdEnv()) {
            console.warn(
              "[supabase/server] setAll() failed (non-fatal). If this happens in a Route Handler, auth may not persist.",
              err
            );
          }
        }
      },
    },
  });
}
