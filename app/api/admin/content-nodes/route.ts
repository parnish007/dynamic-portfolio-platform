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
// Small helpers
// ---------------------------------------------
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asNullableTrimmedString(value: unknown): string | null {
  const s = asTrimmedString(value);
  return s ? s : null;
}

function isValidNodeType(value: unknown): value is NodeType {
  return value === "folder" || value === "section" || value === "project" || value === "blog";
}

function asNumber(value: unknown, fallback: number) {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  if (typeof value === "string") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }

  return fallback;
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

  const { data: byUserId, error: e1 } = await supabase
    .from("admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (!e1 && byUserId) {
    return { ok: true as const };
  }

  const { data: byId, error: e2 } = await supabase
    .from("admins")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (e2) {
    return { ok: false as const, status: 500, error: "INTERNAL_ERROR" as const };
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
// Accept both snake_case and camelCase payloads.
// =============================================
export async function POST(req: Request) {
  try {
    const supabase = createSupabaseServerClient();

    const admin = await requireAdmin(supabase);
    if (!admin.ok) {
      return json(admin.status, { ok: false, error: admin.error });
    }

    let body: unknown = null;
    try {
      body = await req.json();
    } catch {
      body = null;
    }

    if (!isPlainObject(body)) {
      return json(400, { ok: false, error: "INVALID_JSON_BODY" });
    }

    const title = asTrimmedString(body.title);
    if (!title) {
      return json(400, { ok: false, error: "TITLE_REQUIRED" });
    }

    const parentRaw = body.parent_id ?? body.parentId ?? null;
    const parent_id = asNullableTrimmedString(parentRaw);

    const nodeTypeRaw = body.node_type ?? body.nodeType ?? "folder";
    const node_type: NodeType = isValidNodeType(nodeTypeRaw) ? nodeTypeRaw : "folder";

    const slugRaw = body.slug ?? null;
    const slug = asNullableTrimmedString(slugRaw);

    const refRaw = body.ref_id ?? body.refId ?? null;
    const ref_id = asNullableTrimmedString(refRaw);

    const orderRaw = body.order_index ?? body.orderIndex ?? 0;
    const order_index = asNumber(orderRaw, 0);

    const iconRaw = body.icon ?? null;
    const icon = asNullableTrimmedString(iconRaw);

    const descRaw = body.description ?? null;
    const description = asNullableTrimmedString(descRaw);

    const insertPayload = {
      parent_id,
      node_type,
      title,
      slug,
      ref_id,
      order_index,
      icon,
      description,
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
