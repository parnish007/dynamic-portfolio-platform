// app/api/auth/me/route.ts

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type MeOk = {
  ok: true;
  authenticated: true;
  user: {
    email: string;
    role: "admin";
  };
};

type MeNoAuth = {
  ok: false;
  authenticated: false;
  error: "UNAUTHENTICATED";
};

type MeErr = {
  ok: false;
  authenticated: false;
  error: "INTERNAL_ERROR";
  details?: string;
};

type MeMethod = {
  ok: false;
  authenticated: false;
  error: "METHOD_NOT_ALLOWED";
  details?: string;
};

function json(status: number, body: MeOk | MeNoAuth | MeErr | MeMethod) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function isProdEnv(): boolean {
  return (process.env.NODE_ENV ?? "").toLowerCase() === "production";
}

function devDetails(message: string) {
  return isProdEnv() ? undefined : message;
}

/**
 * Admin check strategy:
 * 1) Prefer RPC: public.is_admin()  (avoids querying admins table and avoids RLS recursion)
 * 2) Fallback: select from admins by id (works if your admins SELECT policy is simple, e.g. id = auth.uid())
 */
async function isAdmin(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  userId: string
): Promise<{ ok: true; isAdmin: boolean } | { ok: false; details: string }> {
  // 1) RPC first (recommended)
  try {
    const rpcRes = await supabase.rpc("is_admin");
    if (!rpcRes.error) {
      return { ok: true, isAdmin: Boolean(rpcRes.data) };
    }

    // If RPC exists but fails, continue to fallback
    // (could be missing permissions, missing function, etc.)
  } catch (e) {
    // ignore and fallback
  }

  // 2) Fallback: direct admins table check
  const byId = await supabase.from("admins").select("id").eq("id", userId).maybeSingle();

  if (byId.error) {
    // If user has old recursive RLS policy, we’ll get recursion error here.
    return { ok: false, details: byId.error.message };
  }

  return { ok: true, isAdmin: Boolean(byId.data?.id) };
}

export async function GET(req: Request) {
  try {
    // Optional admin secret override (only if you explicitly set ADMIN_API_SECRET)
    const secret = (process.env.ADMIN_API_SECRET ?? "").trim();
    if (secret) {
      const headerSecret = req.headers.get("x-admin-api-secret") ?? "";
      if (headerSecret && headerSecret === secret) {
        const payload: MeOk = {
          ok: true,
          authenticated: true,
          user: { email: "admin-secret@local", role: "admin" },
        };
        return json(200, payload);
      }
    }

    const supabase = createSupabaseServerClient();

    const { data, error } = await supabase.auth.getUser();
    const user = data?.user;

    if (error || !user) {
      const payload: MeNoAuth = {
        ok: false,
        authenticated: false,
        error: "UNAUTHENTICATED",
      };
      return json(401, payload);
    }

    const adminRes = await isAdmin(supabase, user.id);

    if (!adminRes.ok) {
      // Helpful dev-only message for the exact bug you hit
      const hint =
        adminRes.details.includes("infinite recursion detected in policy for relation")
          ? "Your public.admins RLS policy is recursive. Fix it by removing any policy that queries public.admins inside itself (e.g. EXISTS (SELECT 1 FROM public.admins ...)). Use a non-recursive check like (id = auth.uid()) OR rely on RPC public.is_admin() as SECURITY DEFINER."
          : adminRes.details;

      const payload: MeErr = {
        ok: false,
        authenticated: false,
        error: "INTERNAL_ERROR",
        details: devDetails(hint),
      };
      return json(500, payload);
    }

    if (!adminRes.isAdmin) {
      const payload: MeNoAuth = {
        ok: false,
        authenticated: false,
        error: "UNAUTHENTICATED",
      };
      return json(401, payload);
    }

    const payload: MeOk = {
      ok: true,
      authenticated: true,
      user: {
        email: user.email ?? "",
        role: "admin",
      },
    };

    return json(200, payload);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error.";
    const payload: MeErr = {
      ok: false,
      authenticated: false,
      error: "INTERNAL_ERROR",
      details: devDetails(msg),
    };
    return json(500, payload);
  }
}

/**
 * Method guards
 */
export async function POST() {
  const payload: MeMethod = {
    ok: false,
    authenticated: false,
    error: "METHOD_NOT_ALLOWED",
    details: "Method not allowed. Use GET.",
  };
  return json(405, payload);
}

export async function PUT() {
  return POST();
}

export async function PATCH() {
  return POST();
}

export async function DELETE() {
  return POST();
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Cache-Control": "no-store",
      "Access-Control-Allow-Methods": "GET,OPTIONS",
      "Access-Control-Allow-Headers": "content-type, cookie, x-admin-api-secret",
    },
  });
}
