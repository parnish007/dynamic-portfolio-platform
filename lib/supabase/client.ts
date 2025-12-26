// lib/supabase/client.ts

// ============================================
// Supabase Clients
// - Browser Client: Client Components only
// - Middleware Client: middleware.ts only (request/response cookie sync)
// NOTE:
// - Server Route Handlers / Server Components should use:
//   import { createSupabaseServerClient } from "@/lib/supabase/server";
// ============================================

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { createBrowserClient, createServerClient } from "@supabase/ssr";

// ============================================
// Env Helpers (strict)
// ============================================

function getSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!url) {
    throw new Error("Missing env: NEXT_PUBLIC_SUPABASE_URL");
  }

  return url;
}

function getSupabaseAnonKey(): string {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!key) {
    throw new Error("Missing env: NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  return key;
}

// ============================================
// Browser Client (Client Components)
// ============================================

export function createSupabaseBrowserClient() {
  return createBrowserClient(getSupabaseUrl(), getSupabaseAnonKey());
}

// Optional convenience alias (for existing imports in your codebase)
export const supabaseClient = createSupabaseBrowserClient;

// ============================================
// Middleware Client (Request/Response cookie sync)
// IMPORTANT:
// - Must accept both request and response
// - Writes updated auth cookies into the response
// ============================================

export function createSupabaseMiddlewareClient(
  request: NextRequest,
  response: NextResponse
) {
  return createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      get(name) {
        return request.cookies.get(name)?.value;
      },
      set(name, value, options) {
        response.cookies.set({ name, value, ...options });
      },
      remove(name, options) {
        response.cookies.set({ name, value: "", ...options });
      },
    },
  });
}

// ============================================
// Backward compatibility (DO NOT use going forward)
// Some older files may still import createSupabaseServerClient from here.
// We re-export from the canonical server helper to avoid breaking.
// ============================================

export { createSupabaseServerClient } from "@/lib/supabase/server";
