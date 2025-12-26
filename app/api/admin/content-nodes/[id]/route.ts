// app/api/admin/content-nodes/[id]/route.ts
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
// Helpers
// ---------------------------------------------
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidNodeType(value: unknown): value is NodeType {
  return value === "folder" || value === "section" || value === "project" || value === "blog";
}

function cleanNullableString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return null;
  const s = value.trim();
  return s ? s : null;
}

function asNumber(value: unknown, fallback: number) {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  if (typeof value === "string") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }

  return fallback;
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

async function getNode(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  nodeId: string
): Promise<
  | { ok: true; node: { id: string; parent_id: string | null; node_type: NodeType; ref_id: string | null } }
  | { ok: false; status: number; error: string }
> {
  const { data, error } = await supabase
    .from("content_nodes")
    .select("id,parent_id,node_type,ref_id")
    .eq("id", nodeId)
    .maybeSingle();

  if (error) return { ok: false as const, status: 500, error: error.message };
  if (!data) return { ok: false as const, status: 404, error: "NOT_FOUND" };

  const nt = data.node_type;
  const node_type: NodeType = isValidNodeType(nt) ? nt : "folder";

  return {
    ok: true as const,
    node: {
      id: data.id as string,
      parent_id: (data.parent_id as string | null) ?? null,
      node_type,
      ref_id: (data.ref_id as string | null) ?? null,
    },
  };
}

async function ensureParentIsFolderIfSet(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  parentId: string
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const { data, error } = await supabase
    .from("content_nodes")
    .select("id,node_type")
    .eq("id", parentId)
    .maybeSingle();

  if (error) return { ok: false as const, status: 500, error: error.message };
  if (!data) return { ok: false as const, status: 400, error: "PARENT_NOT_FOUND" };

  if (data.node_type !== "folder") {
    return { ok: false as const, status: 400, error: "PARENT_MUST_BE_FOLDER" };
  }

  return { ok: true as const };
}

async function wouldCreateCycle(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  nodeId: string,
  nextParentId: string
): Promise<boolean> {
  // Efficient-ish: fetch all ancestor links in a bounded loop.
  // Still looped, but avoids “return true on any error” ambiguity and keeps guard.
  let current: string | null = nextParentId;
  let guard = 0;

  while (current) {
    guard += 1;
    if (guard > 300) return true; // treat as unsafe

    if (current === nodeId) return true;

    const { data, error } = await supabase
      .from("content_nodes")
      .select("parent_id")
      .eq("id", current)
      .maybeSingle();

    if (error) return true; // unsafe
    current = (data?.parent_id as string | null) ?? null;
  }

  return false;
}

// =============================================
// PATCH → Update node (rename / move / reorder / link)
// Accept both snake_case and camelCase payloads.
// File-manager rules:
// - parent must be folder (if not null)
// - cannot move into itself/descendant
// - if node_type becomes blog/project => ref_id required
// =============================================
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const nodeId = params.id;
    if (!nodeId) return json(400, { ok: false, error: "ID_REQUIRED" });

    const supabase = createSupabaseServerClient();

    const admin = await requireAdmin(supabase);
    if (!admin.ok) {
      return json(admin.status, { ok: false, error: admin.error, details: (admin as any).details });
    }

    const currentRes = await getNode(supabase, nodeId);
    if (!currentRes.ok) return json(currentRes.status, { ok: false, error: currentRes.error });

    let body: unknown = null;
    try {
      body = await req.json();
    } catch {
      return json(400, { ok: false, error: "INVALID_JSON_BODY" });
    }

    if (!isPlainObject(body)) {
      return json(400, { ok: false, error: "INVALID_JSON_BODY" });
    }

    const b = body;
    const update: Record<string, unknown> = {};

    // Title
    if (typeof b.title === "string") {
      const title = b.title.trim();
      if (!title) return json(400, { ok: false, error: "TITLE_EMPTY" });
      update.title = title;
    }

    // Slug
    if ("slug" in b) {
      update.slug = cleanNullableString((b as any).slug);
    }

    // Icon
    if ("icon" in b) {
      update.icon = cleanNullableString((b as any).icon);
    }

    // Description
    if ("description" in b) {
      update.description = cleanNullableString((b as any).description);
    }

    // Order index
    if ("order_index" in b || "orderIndex" in b) {
      const raw = (b as any).order_index ?? (b as any).orderIndex;

      if (raw !== null && raw !== undefined) {
        const n = asNumber(raw, Number.NaN);
        if (!Number.isFinite(n)) {
          return json(400, { ok: false, error: "ORDER_INDEX_INVALID" });
        }
        update.order_index = n;
      }
    }

    // Parent (move): accept parent_id OR parentId
    if ("parent_id" in b || "parentId" in b) {
      const raw = (b as any).parent_id ?? (b as any).parentId ?? null;
      const nextParentId = raw === null ? null : cleanNullableString(raw);

      if (nextParentId && nextParentId === nodeId) {
        return json(400, { ok: false, error: "PARENT_CANNOT_BE_SELF" });
      }

      if (nextParentId) {
        const parentOk = await ensureParentIsFolderIfSet(supabase, nextParentId);
        if (!parentOk.ok) return json(parentOk.status, { ok: false, error: parentOk.error });

        const bad = await wouldCreateCycle(supabase, nodeId, nextParentId);
        if (bad) return json(400, { ok: false, error: "PARENT_CANNOT_BE_DESCENDANT" });
      }

      update.parent_id = nextParentId;
    }

    // Ref link: accept ref_id OR refId
    if ("ref_id" in b || "refId" in b) {
      const raw = (b as any).ref_id ?? (b as any).refId ?? null;
      update.ref_id = raw === null ? null : cleanNullableString(raw);
    }

    // Node type: accept node_type OR nodeType
    if ("node_type" in b || "nodeType" in b) {
      const raw = (b as any).node_type ?? (b as any).nodeType;

      if (raw !== null && raw !== undefined) {
        if (!isValidNodeType(raw)) {
          return json(400, { ok: false, error: "NODE_TYPE_INVALID" });
        }
        update.node_type = raw;
      }
    }

    // Validate node_type <-> ref_id constraint
    const nextType: NodeType =
      (typeof update.node_type === "string" && isValidNodeType(update.node_type)
        ? update.node_type
        : currentRes.node.node_type) as NodeType;

    const nextRefId =
      "ref_id" in update ? (update.ref_id as string | null) : currentRes.node.ref_id;

    if (requiresRefId(nextType) && !nextRefId) {
      return json(400, { ok: false, error: "REF_ID_REQUIRED" });
    }

    if (Object.keys(update).length === 0) {
      return json(400, { ok: false, error: "NO_FIELDS_TO_UPDATE" });
    }

    // Keep (non-breaking) — if you later confirm DB trigger exists, we can remove.
    update.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from("content_nodes")
      .update(update)
      .eq("id", nodeId)
      .select("*")
      .maybeSingle();

    if (error) return json(500, { ok: false, error: "DB_ERROR", details: error.message });
    if (!data) return json(404, { ok: false, error: "NOT_FOUND" });

    return json(200, { ok: true, node: data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return json(500, { ok: false, error: "INTERNAL_ERROR", details: msg });
  }
}

// =============================================
// DELETE → Remove node (only if no children)
// =============================================
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const nodeId = params.id;
    if (!nodeId) return json(400, { ok: false, error: "ID_REQUIRED" });

    const supabase = createSupabaseServerClient();

    const admin = await requireAdmin(supabase);
    if (!admin.ok) {
      return json(admin.status, { ok: false, error: admin.error, details: (admin as any).details });
    }

    const { count, error: childErr } = await supabase
      .from("content_nodes")
      .select("id", { count: "exact", head: true })
      .eq("parent_id", nodeId);

    if (childErr) return json(500, { ok: false, error: "DB_ERROR", details: childErr.message });

    if ((count ?? 0) > 0) {
      return json(409, {
        ok: false,
        error: "HAS_CHILDREN",
        details: "Cannot delete a node that still has children.",
      });
    }

    const { error } = await supabase.from("content_nodes").delete().eq("id", nodeId);

    if (error) return json(500, { ok: false, error: "DB_ERROR", details: error.message });

    return json(200, { ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return json(500, { ok: false, error: "INTERNAL_ERROR", details: msg });
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
