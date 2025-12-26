// app/api/admin/content-nodes/[id]/route.ts

import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function json(status: number, body: unknown) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

// ---------------------------------------------
// Admin Guard (safe, minimal, non-breaking)
// - Supports BOTH schemas:
//   A) admins.user_id = auth.users.id   (recommended)
//   B) admins.id      = auth.users.id   (legacy)
// ---------------------------------------------
async function requireAdmin(
  supabase: ReturnType<typeof createSupabaseServerClient>
) {
  const { data: userRes, error: userErr } = await supabase.auth.getUser();

  if (userErr || !userRes.user) {
    return {
      ok: false as const,
      status: 401,
      error: "UNAUTHENTICATED" as const,
    };
  }

  const userId = userRes.user.id;

  const { data: byUserId, error: e1 } = await supabase
    .from("admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (!e1 && byUserId) return { ok: true as const };

  const { data: byId, error: e2 } = await supabase
    .from("admins")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (e2) {
    return {
      ok: false as const,
      status: 500,
      error: "INTERNAL_ERROR" as const,
    };
  }

  if (!byId) {
    return {
      ok: false as const,
      status: 403,
      error: "FORBIDDEN" as const,
    };
  }

  return { ok: true as const };
}

// =============================================
// PATCH → Update node (rename / move / reorder)
// =============================================
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const nodeId = params.id;
    if (!nodeId) return json(400, { ok: false, error: "ID_REQUIRED" });

    const supabase = createSupabaseServerClient();

    const admin = await requireAdmin(supabase);
    if (!admin.ok) return json(admin.status, { ok: false, error: admin.error });

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      body = null;
    }

    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return json(400, { ok: false, error: "INVALID_JSON_BODY" });
    }

    const b = body as Partial<{
      title: string;
      parentId: string | null;
      slug: string | null;
      orderIndex: number;
      icon: string | null;
      description: string | null;
    }>;

    const update: Record<string, unknown> = {};

    if (typeof b.title === "string") {
      const title = b.title.trim();
      if (!title) return json(400, { ok: false, error: "TITLE_EMPTY" });
      update.title = title;
    }

    if ("parentId" in b) {
      update.parent_id = b.parentId ?? null;
    }

    if ("slug" in b) {
      update.slug = b.slug ?? null;
    }

    if (typeof b.orderIndex === "number" && Number.isFinite(b.orderIndex)) {
      update.order_index = b.orderIndex;
    }

    if ("icon" in b) {
      update.icon = b.icon ?? null;
    }

    if ("description" in b) {
      update.description = b.description ?? null;
    }

    if (Object.keys(update).length === 0) {
      return json(400, { ok: false, error: "NO_FIELDS_TO_UPDATE" });
    }

    update.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from("content_nodes")
      .update(update)
      .eq("id", nodeId)
      .select("*")
      .single();

    if (error) return json(500, { ok: false, error: error.message });

    return json(200, { ok: true, node: data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return json(500, { ok: false, error: msg });
  }
}

// =============================================
// DELETE → Remove node (only if no children)
// =============================================
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const nodeId = params.id;
    if (!nodeId) return json(400, { ok: false, error: "ID_REQUIRED" });

    const supabase = createSupabaseServerClient();

    const admin = await requireAdmin(supabase);
    if (!admin.ok) return json(admin.status, { ok: false, error: admin.error });

    // Safety: prevent deleting nodes that still have children
    const { count, error: childErr } = await supabase
      .from("content_nodes")
      .select("id", { count: "exact", head: true })
      .eq("parent_id", nodeId);

    if (childErr) return json(500, { ok: false, error: childErr.message });

    if ((count ?? 0) > 0) {
      return json(409, {
        ok: false,
        error: "HAS_CHILDREN",
        details: "Cannot delete a node that still has children.",
      });
    }

    const { error } = await supabase.from("content_nodes").delete().eq("id", nodeId);

    if (error) return json(500, { ok: false, error: error.message });

    return json(200, { ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return json(500, { ok: false, error: msg });
  }
}

// ---------------------------------------------
// Method Guards
// ---------------------------------------------
export async function GET() {
  return json(405, { ok: false, error: "METHOD_NOT_ALLOWED" });
}

export async function POST() {
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
      "Access-Control-Allow-Methods": "PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "content-type",
    },
  });
}
