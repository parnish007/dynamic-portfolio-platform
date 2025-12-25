// middleware.ts

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

function isPublicAsset(pathname: string): boolean {
  if (pathname.startsWith("/_next/")) return true;
  if (pathname === "/favicon.ico") return true;
  if (pathname === "/robots.txt") return true;
  if (pathname === "/sitemap.xml") return true;
  if (pathname.startsWith("/images/")) return true;
  if (pathname.startsWith("/icons/")) return true;
  if (pathname.startsWith("/assets/")) return true;
  if (pathname.startsWith("/fallback/")) return true;
  return false;
}

function isApiRoute(pathname: string): boolean {
  return pathname.startsWith("/api/");
}

/**
 * Your admin pages are mounted at ROOT because (admin) is a route group:
 * /login, /dashboard, /content, /blogs, /projects, etc.
 */
function isAdminPath(pathname: string): boolean {
  if (pathname === "/login") return true;
  if (pathname === "/dashboard") return true;
  if (pathname === "/content") return true;
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
  return pathname === "/login";
}

function buildLoginRedirect(req: NextRequest): NextResponse {
  const next = req.nextUrl.pathname + (req.nextUrl.search || "");
  const url = new URL("/login", req.url);
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
  if (isApiRoute(pathname)) return NextResponse.next();

  if (!isAdminPath(pathname)) return NextResponse.next();

  if (isLoginPath(pathname)) return NextResponse.next();

  const ok = await isAuthenticated(req);

  if (!ok) return buildLoginRedirect(req);

  return NextResponse.next();
}

export const config = {
  matcher: [
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
