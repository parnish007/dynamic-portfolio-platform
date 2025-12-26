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

function requiresRefId(nodeType: NodeType): boolean {
  return nodeType === "blog" || nodeType === "project";
}

// ---------------------------------------------
// Admin Guard (authoritative)
// - Supabase SSR cookies
// - RPC public.is_admin() SECURITY DEFINER
// ---------------------------------------------
async function requireAdmin(supabase: ReturnType<typeof createSupabaseServerClient>) {
  const { data: userRes, error: userErr } = await supabase.auth.getUser();

  if (userErr || !userRes.user) {
    return { ok: false as const, status: 401, error: "UNAUTHENTICATED" as const };
  }

  const { data: isAdmin, error: rpcErr } = await supabase.rpc("is_admin");

  if (rpcErr) {
    return {
      ok: false as const,
      status: 500,
      error: "ADMIN_CHECK_FAILED" as const,
      details: rpcErr.message,
    };
  }

  if (!isAdmin) {
    return { ok: false as const, status: 403, error: "FORBIDDEN" as const };
  }

  return { ok: true as const };
}

async function ensureParentFolderIfSet(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  parent_id: string | null
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  if (!parent_id) return { ok: true as const };

  const { data, error } = await supabase
    .from("content_nodes")
    .select("id,node_type")
    .eq("id", parent_id)
    .maybeSingle();

  if (error) return { ok: false as const, status: 500, error: "DB_ERROR" };
  if (!data) return { ok: false as const, status: 400, error: "PARENT_NOT_FOUND" };
  if (data.node_type !== "folder") return { ok: false as const, status: 400, error: "PARENT_MUST_BE_FOLDER" };

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
  const prev = top && typeof (top as any).order_index === "number" ? (top as any).order_index : -1;

  return prev + 1;
}

// =============================================
// GET → Fetch full content tree (admin)
// =============================================
export async function GET() {
  try {
    const supabase = createSupabaseServerClient();

    const admin = await requireAdmin(supabase);
    if (!admin.ok) {
      return json(admin.status, { ok: false, error: admin.error, details: (admin as any).details });
    }

    const { data, error } = await supabase
      .from("content_nodes")
      .select("*")
      .order("parent_id", { ascending: true, nullsFirst: true })
      .order("order_index", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      return json(500, { ok: false, error: "DB_ERROR", details: error.message });
    }

    return json(200, { ok: true, nodes: data ?? [] });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return json(500, { ok: false, error: "INTERNAL_ERROR", details: msg });
  }
}

// =============================================
// POST → Create node (folder by default)
// Accept both snake_case and camelCase payloads.
// File-manager behavior:
// - parent must be folder (if set)
// - If order_index not provided => append at end (max+1)
// - blog/project require ref_id
// - slug auto-generated if missing (especially for blog/project)
// =============================================
export async function POST(req: Request) {
  try {
    const supabase = createSupabaseServerClient();

    const admin = await requireAdmin(supabase);
    if (!admin.ok) {
      return json(admin.status, { ok: false, error: admin.error, details: (admin as any).details });
    }

    let body: unknown = null;
    try {
      body = await req.json();
    } catch {
      return json(400, { ok: false, error: "INVALID_JSON_BODY" });
    }

    if (!isPlainObject(body)) {
      return json(400, { ok: false, error: "INVALID_JSON_BODY" });
    }

    const title = asTrimmedString(body.title);
    if (!title) {
      return json(400, { ok: false, error: "TITLE_REQUIRED" });
    }

    const parentRaw = (body as any).parent_id ?? (body as any).parentId ?? null;
    const parent_id = parentRaw === null ? null : asNullableTrimmedString(parentRaw);

    // Validate parent folder if provided (fixes unreliable subfolder behavior)
    const parentOk = await ensureParentFolderIfSet(supabase, parent_id);
    if (!parentOk.ok) {
      return json(parentOk.status, { ok: false, error: parentOk.error });
    }

    const nodeTypeRaw = (body as any).node_type ?? (body as any).nodeType ?? "folder";
    const node_type: NodeType = isValidNodeType(nodeTypeRaw) ? nodeTypeRaw : "folder";

    const refRaw = (body as any).ref_id ?? (body as any).refId ?? null;
    const ref_id = refRaw === null ? null : asNullableTrimmedString(refRaw);

    if (requiresRefId(node_type) && !ref_id) {
      return json(400, { ok: false, error: "REF_ID_REQUIRED" });
    }

    const slugRaw = (body as any).slug ?? null;
    const slugFromBody = slugRaw === null ? null : asNullableTrimmedString(slugRaw);
    const slug =
      slugFromBody ?? (requiresRefId(node_type) ? slugify(title) : null);

    const iconRaw = (body as any).icon ?? null;
    const icon = iconRaw === null ? null : asNullableTrimmedString(iconRaw);

    const descRaw = (body as any).description ?? null;
    const description = descRaw === null ? null : asNullableTrimmedString(descRaw);

    // order_index:
    // - if provided use it
    // - else compute append
    const orderWasProvided = hasOwn(body, "order_index") || hasOwn(body, "orderIndex");
    const order_index = orderWasProvided
      ? asNumber((body as any).order_index ?? (body as any).orderIndex ?? 0, 0)
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

    const { data, error } = await supabase.from("content_nodes").insert(insertPayload).select("*").single();

    if (error) {
      return json(500, { ok: false, error: "DB_ERROR", details: error.message });
    }

    return json(201, { ok: true, node: data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return json(500, { ok: false, error: "INTERNAL_ERROR", details: msg });
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
