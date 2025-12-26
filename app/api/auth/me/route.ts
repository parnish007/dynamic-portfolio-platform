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
 * Admin check strategy (STRICT):
 * ✅ Use RPC: public.is_admin() SECURITY DEFINER
 *
 * Why:
 * - Avoids querying public.admins directly (RLS can block SELECT)
 * - Prevents recursion-policy pitfalls
 * - Matches your project agenda: centralized, secure admin check
 */
async function isAdminViaRpc(
  supabase: ReturnType<typeof createSupabaseServerClient>
): Promise<{ ok: true; isAdmin: boolean } | { ok: false; details: string }> {
  const rpcRes = await supabase.rpc("is_admin");

  if (rpcRes.error) {
    return { ok: false, details: rpcRes.error.message };
  }

  return { ok: true, isAdmin: Boolean(rpcRes.data) };
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

    const adminRes = await isAdminViaRpc(supabase);

    if (!adminRes.ok) {
      const payload: MeErr = {
        ok: false,
        authenticated: false,
        error: "INTERNAL_ERROR",
        details: devDetails(
          `Admin check failed: ${adminRes.details}. Ensure SQL function public.is_admin() exists and is SECURITY DEFINER.`
        ),
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
