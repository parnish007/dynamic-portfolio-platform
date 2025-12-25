// ============================================
// Imports
// ============================================

import type { NextRequest } from "next/server";

import { NextResponse } from "next/server";

import { createServerClient } from "@supabase/ssr";


// ============================================
// Helpers
// ============================================

const isPublicFile = (pathname: string) => {

  if (pathname.startsWith("/_next")) return true;
  if (pathname.startsWith("/favicon")) return true;
  if (pathname.startsWith("/robots.txt")) return true;
  if (pathname.startsWith("/sitemap.xml")) return true;

  if (pathname.startsWith("/assets")) return true;
  if (pathname.startsWith("/images")) return true;

  if (pathname.startsWith("/public")) return true;

  const fileExtensionPattern = /\.[a-zA-Z0-9]+$/;

  if (fileExtensionPattern.test(pathname)) return true;

  return false;
};

const isAdminRoute = (pathname: string) => {

  if (pathname.startsWith("/admin")) return true;

  return false;
};

const isAdminAuthRoute = (pathname: string) => {

  if (pathname === "/admin/login") return true;

  return false;
};


// ============================================
// Main Middleware Logic
// ============================================

export const withAuthMiddleware = async (
  request: NextRequest
) => {

  const { pathname } = request.nextUrl;

  if (isPublicFile(pathname)) {
    return NextResponse.next();
  }

  // Comment
  // Only protect /admin routes. Everything else is public.

  if (!isAdminRoute(pathname)) {
    return NextResponse.next();
  }

  // Comment
  // Allow /admin/login always (otherwise infinite redirect loop).

  if (isAdminAuthRoute(pathname)) {
    return NextResponse.next();
  }

  // Comment
  // Create a response early so Supabase can attach refreshed cookies.

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
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

  const { data } = await supabase.auth.getSession();

  const session = data.session;

  if (!session) {

    const loginUrl = request.nextUrl.clone();

    loginUrl.pathname = "/admin/login";

    loginUrl.searchParams.set("next", pathname);

    return NextResponse.redirect(loginUrl);
  }

  return response;
};
