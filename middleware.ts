// middleware.ts

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/**
 * STRICT boundary (recommended):
 * - Admin pages: /admin/*
 * - Admin APIs:  /api/admin/*
 *
 * Legacy root admin routes are OPTIONAL and can be enabled via:
 *   NEXT_PUBLIC_ENABLE_LEGACY_ADMIN_ROUTES=true
 *
 * This prevents accidental protection of public routes like /blogs or /projects.
 */

const ENABLE_LEGACY_ADMIN =
  process.env.NEXT_PUBLIC_ENABLE_LEGACY_ADMIN_ROUTES === "true";

function isPublicAsset(pathname: string): boolean {
  if (pathname.startsWith("/_next/")) return true;
  if (pathname === "/favicon.ico") return true;
  if (pathname === "/robots.txt") return true;
  if (pathname === "/sitemap.xml") return true;

  // common static folders
  if (pathname.startsWith("/images/")) return true;
  if (pathname.startsWith("/icons/")) return true;
  if (pathname.startsWith("/assets/")) return true;
  if (pathname.startsWith("/fallback/")) return true;
  if (pathname.startsWith("/fonts/")) return true;

  return false;
}

function isApiRoute(pathname: string): boolean {
  return pathname.startsWith("/api/");
}

function isAdminApiRoute(pathname: string): boolean {
  return pathname === "/api/admin" || pathname.startsWith("/api/admin/");
}

function isAdminPageRoute(pathname: string): boolean {
  if (pathname === "/admin") return true;
  if (pathname.startsWith("/admin/")) return true;

  if (!ENABLE_LEGACY_ADMIN) return false;

  // Legacy admin pages (ONLY if flag enabled)
  if (pathname === "/login") return true;
  if (pathname === "/dashboard") return true;
  if (pathname === "/content") return true;

  // ⚠️ These are common public paths; legacy should be avoided.
  // Keep only if your app truly still uses these as admin pages.
  if (pathname === "/blogs") return true;
  if (pathname.startsWith("/blogs/")) return true;
  if (pathname === "/projects") return true;
  if (pathname.startsWith("/projects/")) return true;

  if (pathname === "/media") return true;
  if (pathname === "/seo") return true;
  if (pathname === "/settings") return true;
  if (pathname === "/chat") return true;
  if (pathname === "/chatbot") return true;

  return false;
}

function isLoginPath(pathname: string): boolean {
  // Canonical
  if (pathname === "/admin/login") return true;

  // Legacy (ONLY if enabled)
  if (ENABLE_LEGACY_ADMIN && pathname === "/login") return true;

  return false;
}

function buildLoginRedirect(req: NextRequest): NextResponse {
  const next = req.nextUrl.pathname + (req.nextUrl.search || "");

  // Canonical admin login path always
  const url = new URL("/admin/login", req.url);
  url.searchParams.set("next", next);

  return NextResponse.redirect(url);
}

function extractOkFromMePayload(payload: unknown): boolean {
  if (typeof payload !== "object" || payload === null) return false;

  const p = payload as Record<string, unknown>;

  if (p.ok === true) return true;
  if (typeof p.authenticated === "boolean") return p.authenticated;
  if (p.user && typeof p.user === "object") return true;

  return false;
}

async function isAuthenticated(req: NextRequest): Promise<boolean> {
  try {
    const meUrl = new URL("/api/auth/me", req.url);

    const res = await fetch(meUrl, {
      method: "GET",
      headers: {
        cookie: req.headers.get("cookie") ?? "",
      },
      cache: "no-store",
    });

    if (!res.ok) return false;

    const data = (await res.json()) as unknown;
    return extractOkFromMePayload(data);
  } catch {
    return false;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isPublicAsset(pathname)) return NextResponse.next();

  // ----------------------------
  // API handling
  // ----------------------------
  if (isApiRoute(pathname)) {
    // Always allow OPTIONS to pass (CORS / preflight).
    if (req.method === "OPTIONS") return NextResponse.next();

    // Protect ONLY /api/admin/*
    if (!isAdminApiRoute(pathname)) return NextResponse.next();

    const ok = await isAuthenticated(req);

    if (!ok) {
      return NextResponse.json(
        { ok: false, error: "UNAUTHENTICATED" },
        {
          status: 401,
          headers: { "Cache-Control": "no-store" },
        }
      );
    }

    return NextResponse.next();
  }

  // ----------------------------
  // Page handling
  // ----------------------------
  if (!isAdminPageRoute(pathname)) return NextResponse.next();

  const res = NextResponse.next();
  res.headers.set("x-pathname", pathname);

  if (isLoginPath(pathname)) return res;

  const ok = await isAuthenticated(req);
  if (!ok) return buildLoginRedirect(req);

  return res;
}

export const config = {
  matcher: [
    // Canonical protection only:
    "/api/admin/:path*",
    "/admin/:path*",

    // Legacy protection (optional flag, but matcher must still include them
    // if you want middleware to run for those paths)
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
