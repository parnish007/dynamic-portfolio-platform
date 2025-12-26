// app/api/admin/content-nodes/route.ts

import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type NodeType = "folder" | "section" | "project" | "blog";

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
    return { ok: false as const, status: 401, error: "UNAUTHENTICATED" as const };
  }

  const userId = userRes.user.id;

  // Preferred: user_id column
  const { data: byUserId, error: e1 } = await supabase
    .from("admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (!e1 && byUserId) {
    return { ok: true as const };
  }

  // Fallback: id column (legacy)
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
    return { ok: false as const, status: 403, error: "FORBIDDEN" as const };
  }

  return { ok: true as const };
}

// =============================================
// GET → Fetch full content tree
// =============================================
export async function GET() {
  try {
    const supabase = createSupabaseServerClient();

    const admin = await requireAdmin(supabase);
    if (!admin.ok) {
      return json(admin.status, { ok: false, error: admin.error });
    }

    const { data, error } = await supabase
      .from("content_nodes")
      .select("*")
      .order("parent_id", { ascending: true, nullsFirst: true })
      .order("order_index", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      return json(500, { ok: false, error: error.message });
    }

    return json(200, { ok: true, nodes: data ?? [] });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return json(500, { ok: false, error: msg });
  }
}

// =============================================
// POST → Create node (folder by default)
// =============================================
export async function POST(req: Request) {
  try {
    const supabase = createSupabaseServerClient();

    const admin = await requireAdmin(supabase);
    if (!admin.ok) {
      return json(admin.status, { ok: false, error: admin.error });
    }

    const body = (await req.json()) as Partial<{
      parentId: string | null;
      nodeType: NodeType;
      title: string;
      slug: string | null;
      refId: string | null;
      orderIndex: number;
      icon: string | null;
      description: string | null;
    }>;

    const title = String(body.title ?? "").trim();
    if (!title) {
      return json(400, { ok: false, error: "TITLE_REQUIRED" });
    }

    const insertPayload = {
      parent_id: body.parentId ?? null,
      node_type: body.nodeType ?? "folder",
      title,
      slug: body.slug ?? null,
      ref_id: body.refId ?? null,
      order_index: typeof body.orderIndex === "number" ? body.orderIndex : 0,
      icon: body.icon ?? null,
      description: body.description ?? null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("content_nodes")
      .insert(insertPayload)
      .select("*")
      .single();

    if (error) {
      return json(500, { ok: false, error: error.message });
    }

    return json(201, { ok: true, node: data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return json(500, { ok: false, error: msg });
  }
}

// ---------------------------------------------
// Method guards
// ---------------------------------------------
export async function PUT() {
  return json(405, { ok: false, error: "METHOD_NOT_ALLOWED" });
}

export async function PATCH() {
  return json(405, { ok: false, error: "METHOD_NOT_ALLOWED" });
}

export async function DELETE() {
  return json(405, { ok: false, error: "METHOD_NOT_ALLOWED" });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Cache-Control": "no-store",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "content-type",
    },
  });
}
