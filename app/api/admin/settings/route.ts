// app/api/admin/settings/route.ts

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// ---------------------------------------------
// Helpers
// ---------------------------------------------
function json(status: number, body: unknown) {
  return NextResponse.json(body, { status });
}

// ---------------------------------------------
// Admin Guard (SAFE, CONSISTENT)
// ---------------------------------------------
async function requireAdmin(
  supabase: ReturnType<typeof createSupabaseServerClient>
) {
  const { data: userRes, error: userErr } = await supabase.auth.getUser();

  if (userErr || !userRes.user) {
    return { ok: false as const, status: 401, error: "UNAUTHENTICATED" as const };
  }

  const { data: adminRow } = await supabase
    .from("admins")
    .select("id")
    .eq("id", userRes.user.id)
    .maybeSingle();

  if (!adminRow) {
    return { ok: false as const, status: 403, error: "FORBIDDEN" as const };
  }

  return { ok: true as const, userId: userRes.user.id };
}

// =============================================
// GET → Read global admin settings
// =============================================
export async function GET() {
  try {
    const supabase = createSupabaseServerClient();

    const admin = await requireAdmin(supabase);
    if (!admin.ok) {
      return json(admin.status, { ok: false, error: admin.error });
    }

    /**
     * Single-row global settings table
     * id = 'global'
     */
    const { data, error } = await supabase
      .from("settings")
      .select("*")
      .eq("id", "global")
      .maybeSingle();

    if (error) {
      return json(500, { ok: false, error: error.message });
    }

    return json(200, {
      ok: true,
      settings: data ?? {
        id: "global",
        site_status: "active",
        maintenance_mode: false,
        allow_indexing: true,
        availability: "open",
        feature_flags: {},
        updated_at: null,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return json(500, { ok: false, error: msg });
  }
}

// =============================================
// PATCH → Update global settings (SAFE MERGE)
// =============================================
export async function PATCH(req: Request) {
  try {
    const supabase = createSupabaseServerClient();

    const admin = await requireAdmin(supabase);
    if (!admin.ok) {
      return json(admin.status, { ok: false, error: admin.error });
    }

    const body = (await req.json()) as Partial<{
      site_status: "active" | "maintenance";
      maintenance_mode: boolean;
      allow_indexing: boolean;
      availability: "open" | "busy" | "offline";
      feature_flags: Record<string, boolean>;
    }>;

    if (!body || typeof body !== "object") {
      return json(400, { ok: false, error: "INVALID_BODY" });
    }

    const update: Record<string, unknown> = {};

    if ("site_status" in body) update.site_status = body.site_status;
    if ("maintenance_mode" in body) update.maintenance_mode = body.maintenance_mode;
    if ("allow_indexing" in body) update.allow_indexing = body.allow_indexing;
    if ("availability" in body) update.availability = body.availability;
    if ("feature_flags" in body) update.feature_flags = body.feature_flags;

    if (Object.keys(update).length === 0) {
      return json(400, { ok: false, error: "NO_FIELDS_TO_UPDATE" });
    }

    const { data, error } = await supabase
      .from("settings")
      .upsert(
        {
          id: "global",
          ...update,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      )
      .select("*")
      .single();

    if (error) {
      return json(500, { ok: false, error: error.message });
    }

    return json(200, { ok: true, settings: data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return json(500, { ok: false, error: msg });
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
