// app/api/admin/settings/route.ts

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// ---------------------------------------------
// Helpers
// ---------------------------------------------
function json(status: number, body: unknown) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeError(e: unknown): string {
  if (e instanceof Error) return e.message;
  return "Unknown error";
}

function getOrigin(h: Headers): string {
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}

function pickForwardHeaders(h: Headers): Record<string, string> {
  // Forward cookies + IP-ish headers so upstream rate limiting is consistent.
  const out: Record<string, string> = {};
  const cookie = h.get("cookie");
  if (cookie) out.cookie = cookie;

  const xff = h.get("x-forwarded-for");
  if (xff) out["x-forwarded-for"] = xff;

  const xRealIp = h.get("x-real-ip");
  if (xRealIp) out["x-real-ip"] = xRealIp;

  return out;
}

// ---------------------------------------------
// Admin Guard (authoritative)
// - Supabase SSR cookies
// - RPC public.is_admin() SECURITY DEFINER
// - Fallback: if RPC missing, checks admins table (both schemas)
// ---------------------------------------------
async function requireAdmin(
  supabase: ReturnType<typeof createSupabaseServerClient>,
): Promise<
  | { ok: true; userId: string }
  | { ok: false; status: number; error: "UNAUTHENTICATED" | "FORBIDDEN" | "ADMIN_CHECK_FAILED"; details?: string }
> {
  const { data: userRes, error: userErr } = await supabase.auth.getUser();

  if (userErr || !userRes.user) {
    return { ok: false, status: 401, error: "UNAUTHENTICATED" };
  }

  const userId = userRes.user.id;

  // 1) RPC is_admin (best)
  try {
    const { data: isAdmin, error: rpcErr } = await supabase.rpc("is_admin");
    if (!rpcErr && typeof isAdmin === "boolean") {
      if (isAdmin) return { ok: true, userId };
      return { ok: false, status: 403, error: "FORBIDDEN" };
    }
    if (rpcErr) {
      // If RPC exists but failed, surface it
      return { ok: false, status: 500, error: "ADMIN_CHECK_FAILED", details: rpcErr.message };
    }
  } catch {
    // ignore and fallback
  }

  // 2) Fallback: admins.user_id schema
  const { data: byUserId, error: e1 } = await supabase
    .from("admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (!e1 && byUserId) {
    return { ok: true, userId };
  }

  // 3) Legacy fallback: admins.id schema
  const { data: byId, error: e2 } = await supabase
    .from("admins")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (e2) {
    return { ok: false, status: 500, error: "ADMIN_CHECK_FAILED", details: e2.message };
  }

  if (!byId) {
    return { ok: false, status: 403, error: "FORBIDDEN" };
  }

  return { ok: true, userId };
}

// =============================================
// GET → Admin-protected proxy to /api/settings
// =============================================
export async function GET() {
  try {
    const supabase = createSupabaseServerClient();

    const admin = await requireAdmin(supabase);
    if (!admin.ok) {
      return json(admin.status, { ok: false, error: admin.error, details: admin.details });
    }

    const h = headers();
    const origin = getOrigin(h);

    const res = await fetch(`${origin}/api/settings`, {
      method: "GET",
      headers: {
        ...pickForwardHeaders(h),
      },
      cache: "no-store",
    });

    const text = await res.text();
    let data: unknown = null;

    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }

    if (!res.ok) {
      return json(
        res.status,
        isPlainObject(data)
          ? data
          : { ok: false, error: "UPSTREAM_ERROR", details: text.slice(0, 2000) },
      );
    }

    return json(200, isPlainObject(data) ? data : { ok: true, raw: text });
  } catch (e) {
    return json(500, { ok: false, error: "INTERNAL_ERROR", details: safeError(e) });
  }
}

// =============================================
// PATCH → Admin-protected proxy to /api/settings
// (expects same contract as /api/settings)
// =============================================
export async function PATCH(req: Request) {
  try {
    const supabase = createSupabaseServerClient();

    const admin = await requireAdmin(supabase);
    if (!admin.ok) {
      return json(admin.status, { ok: false, error: admin.error, details: admin.details });
    }

    let body: unknown = null;
    try {
      body = await req.json();
    } catch {
      return json(400, { ok: false, error: "INVALID_JSON_BODY" });
    }

    const h = headers();
    const origin = getOrigin(h);

    const res = await fetch(`${origin}/api/settings`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...pickForwardHeaders(h),
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    const text = await res.text();
    let data: unknown = null;

    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }

    if (!res.ok) {
      return json(
        res.status,
        isPlainObject(data)
          ? data
          : { ok: false, error: "UPSTREAM_ERROR", details: text.slice(0, 2000) },
      );
    }

    return json(200, isPlainObject(data) ? data : { ok: true, raw: text });
  } catch (e) {
    return json(500, { ok: false, error: "INTERNAL_ERROR", details: safeError(e) });
  }
}

// =============================================
// METHOD GUARDS
// =============================================
export async function POST() {
  return json(405, { ok: false, error: "METHOD_NOT_ALLOWED" });
}

export async function DELETE() {
  return json(405, { ok: false, error: "METHOD_NOT_ALLOWED" });
}

export async function PUT() {
  return json(405, { ok: false, error: "METHOD_NOT_ALLOWED" });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Cache-Control": "no-store",
      "Access-Control-Allow-Methods": "GET, PATCH, OPTIONS",
      "Access-Control-Allow-Headers": "content-type",
    },
  });
}
