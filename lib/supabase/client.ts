// lib/supabase/client.ts

// ============================================
// Supabase SSR Clients (Browser / Server / Middleware)
// ============================================

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { cookies } from "next/headers";

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
// Server Client (Server Components / Route Handlers)
// Uses Next.js "cookies()" for read/write.
// ============================================

export function createSupabaseServerClient() {
  const cookieStore = cookies();

  return createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      get(name) {
        return cookieStore.get(name)?.value;
      },
      set(name, value, options) {
        cookieStore.set({ name, value, ...options });
      },
      remove(name, options) {
        cookieStore.set({ name, value: "", ...options });
      },
    },
  });
}

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
