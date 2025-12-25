// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function isPublicAsset(pathname: string): boolean {
  if (pathname.startsWith("/_next/")) return true;
  if (pathname.startsWith("/favicon")) return true;
  if (pathname.startsWith("/robots.txt")) return true;
  if (pathname.startsWith("/sitemap.xml")) return true;
  if (pathname.startsWith("/images/")) return true;
  if (pathname.startsWith("/icons/")) return true;
  if (pathname.startsWith("/assets/")) return true;
  if (pathname.startsWith("/fallback/")) return true;
  if (pathname.startsWith("/public/")) return true;
  return false;
}

function isApiRoute(pathname: string): boolean {
  return pathname.startsWith("/api/");
}

/**
 * IMPORTANT NOTE
 * ----------------
 * Next.js route groups like app/(admin) do NOT appear in the URL.
 * Many projects still use /admin/* URLs. To stay safe in your project
 * (since you reference /admin/*), we protect BOTH:
 *  - /admin/* (preferred)
 *  - the admin pages that might be mounted at root due to route-group behavior
 */
function isAdminPath(pathname: string): boolean {
  if (pathname === "/admin") return true;
  if (pathname.startsWith("/admin/")) return true;

  // Safety net: if your (admin) group pages are actually mounted at root
  // (because (admin) is a route group), protect these too.
  const rootAdminPages = new Set([
    "/login",
    "/dashboard",
    "/content",
    "/blogs",
    "/projects",
    "/media",
    "/seo",
    "/settings",
    "/chat",
    "/chatbot",
  ]);

  if (rootAdminPages.has(pathname)) return true;

  // Also protect edit routes if mounted at root
  if (pathname.startsWith("/blogs/edit/")) return true;
  if (pathname.startsWith("/projects/edit/")) return true;

  return false;
}

function isAdminLoginPath(pathname: string): boolean {
  return pathname === "/admin/login" || pathname === "/login";
}

function buildLoginRedirect(req: NextRequest): NextResponse {
  const next = req.nextUrl.pathname + (req.nextUrl.search || "");
  const loginPath = req.nextUrl.pathname.startsWith("/admin") ? "/admin/login" : "/login";

  const url = new URL(loginPath, req.url);
  url.searchParams.set("next", next);

  return NextResponse.redirect(url);
}

async function isAuthenticated(req: NextRequest): Promise<boolean> {
  // Quick cookie presence check (cheap, avoids fetch if obviously unauthenticated)
  // These are common cookie keys across custom auth/supabase/jwt setups.
  const possibleCookieKeys = [
    "session",
    "session_id",
    "access_token",
    "token",
    "auth_token",
    "sb-access-token",
    "sb:token",
  ];

  const hasAnyAuthCookie = possibleCookieKeys.some((k) => {
    const v = req.cookies.get(k)?.value;
    return typeof v === "string" && v.trim().length > 0;
  });

  // Even if cookie not found, still try /api/auth/me (your API might use HttpOnly cookie with a different name)
  // but we can skip the fetch if nothing hints auth AND you want faster redirects.
  // We'll still attempt verification for correctness.
  try {
    const meUrl = new URL("/api/auth/me", req.url);

    const res = await fetch(meUrl, {
      method: "GET",
      headers: {
        // Forward cookies to the API route so it can validate session
        cookie: req.headers.get("cookie") ?? "",
      },
      cache: "no-store",
    });

    if (!res.ok) return false;

    const data = (await res.json()) as unknown;

    if (typeof data === "object" && data !== null && (data as any).ok === true) {
      return true;
    }

    // If API returns some other success shape, fallback to cookie presence
    return hasAnyAuthCookie;
  } catch {
    // If fetch fails (offline/edge issue), fall back to cookie presence
    return hasAnyAuthCookie;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Ignore assets and API routes
  if (isPublicAsset(pathname)) return NextResponse.next();
  if (isApiRoute(pathname)) return NextResponse.next();

  // Only guard admin paths
  if (!isAdminPath(pathname)) return NextResponse.next();

  // Allow access to admin login page
  if (isAdminLoginPath(pathname)) return NextResponse.next();

  // Auth check
  const ok = await isAuthenticated(req);

  if (!ok) {
    return buildLoginRedirect(req);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Preferred admin namespace
    "/admin/:path*",

    // Safety net: if your route-group admin pages are mounted at root
    "/login",
    "/dashboard",
    "/content",
    "/blogs/:path*",
    "/projects/:path*",
    "/media",
    "/seo",
    "/settings",
    "/chat",
    "/chatbot",
  ],
};
