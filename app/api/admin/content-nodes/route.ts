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

function hasOwn(obj: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
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

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// ---------------------------------------------
// Admin Guard (robust)
// 1) Prefer RPC public.is_admin() if available
// 2) Fallback to admins table check (admins.id = auth.uid())
// ---------------------------------------------
async function requireAdmin(supabase: ReturnType<typeof createSupabaseServerClient>) {
  const { data: userRes, error: userErr } = await supabase.auth.getUser();

  if (userErr || !userRes.user) {
    return { ok: false as const, status: 401, error: "UNAUTHENTICATED" as const };
  }

  // 1) RPC check (best)
  try {
    const { data: isAdmin, error: rpcErr } = await supabase.rpc("is_admin");
    if (!rpcErr && typeof isAdmin === "boolean") {
      if (isAdmin) return { ok: true as const };
      return { ok: false as const, status: 403, error: "FORBIDDEN" as const };
    }
  } catch {
    // ignore and fallback
  }

  // 2) Fallback: admins.id == auth.users.id
  const userId = userRes.user.id;

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

async function getNextOrderIndex(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  parent_id: string | null
): Promise<number> {
  // Find current max(order_index) for same parent and return max+1
  let query = supabase.from("content_nodes").select("order_index");

  if (parent_id === null) {
    query = query.is("parent_id", null);
  } else {
    query = query.eq("parent_id", parent_id);
  }

  const { data, error } = await query.order("order_index", { ascending: false }).limit(1);

  if (error) return 0;

  const top = Array.isArray(data) && data.length > 0 ? data[0] : null;
  const prev = top && typeof top.order_index === "number" ? top.order_index : 0;

  return prev + 1;
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
// File-manager behavior:
// - If order_index not provided => append at end (max+1)
// - blog/project require ref_id
// - slug auto-generated if missing (especially for blog/project)
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

    const refRaw = body.ref_id ?? body.refId ?? null;
    const ref_id = asNullableTrimmedString(refRaw);

    // Require ref_id for editor-backed nodes
    if ((node_type === "blog" || node_type === "project") && !ref_id) {
      return json(400, { ok: false, error: "REF_ID_REQUIRED" });
    }

    const slugRaw = body.slug ?? null;
    const slugFromBody = asNullableTrimmedString(slugRaw);
    const slug =
      slugFromBody ??
      ((node_type === "blog" || node_type === "project") ? slugify(title) : null);

    const iconRaw = body.icon ?? null;
    const icon = asNullableTrimmedString(iconRaw);

    const descRaw = body.description ?? null;
    const description = asNullableTrimmedString(descRaw);

    // order_index:
    // - if provided (snake/camel) use it
    // - else compute "append at end"
    const orderWasProvided = hasOwn(body, "order_index") || hasOwn(body, "orderIndex");
    const order_index = orderWasProvided
      ? asNumber(body.order_index ?? body.orderIndex ?? 0, 0)
      : await getNextOrderIndex(supabase, parent_id);

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
