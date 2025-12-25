// ============================================
// Imports
// ============================================

import type { NextRequest } from "next/server";

import { cookies } from "next/headers";

import { createBrowserClient } from "@supabase/ssr";

import { createServerClient } from "@supabase/ssr";

import type { NextResponse } from "next/server";


// ============================================
// Helpers: Env
// ============================================

const getSupabaseUrl = () => {
  return process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
};

const getSupabaseAnonKey = () => {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
};


// ============================================
// Client: Browser Supabase Client
// ============================================

export const createSupabaseBrowserClient = () => {

  return createBrowserClient(
    getSupabaseUrl(),
    getSupabaseAnonKey()
  );
};


// ============================================
// Server: Supabase Client (Server Components / Route Handlers)
// ============================================

export const createSupabaseServerClient = () => {

  const cookieStore = cookies();

  return createServerClient(
    getSupabaseUrl(),
    getSupabaseAnonKey(),
    {
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
    }
  );
};


// ============================================
// Middleware: Supabase Client (Request/Response cookies)
// ============================================

export const createSupabaseMiddlewareClient = (
  request: NextRequest,
  response: NextResponse
) => {

  return createServerClient(
    getSupabaseUrl(),
    getSupabaseAnonKey(),
    {
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
    }
  );
};
