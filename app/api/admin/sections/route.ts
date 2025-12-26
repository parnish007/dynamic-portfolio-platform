// app/api/admin/sections/route.ts

import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type ApiErr = {
  ok: false;
  error: string;
  details?: string;
};

type ApiOkList = {
  ok: true;
  items: Array<Record<string, unknown>>;
  nodes: Array<Record<string, unknown>>;
};

type ApiOkCreate = {
  ok: true;
  item: Record<string, unknown>;
  node: Record<string, unknown>;
};

function isProdEnv(): boolean {
  return (process.env.NODE_ENV ?? "").toLowerCase() === "production";
}

function json(status: number, body: ApiErr | ApiOkList | ApiOkCreate) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function readString(v: unknown, maxLen: number): string {
  if (typeof v !== "string") return "";
  const s = v.trim();
  if (!s) return "";
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

function readNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number.parseFloat(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function readBool(v: unknown): boolean | null {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (s === "true") return true;
    if (s === "false") return false;
  }
  return null;
}

function slugify(input: string): string {
  const s = input
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return s.slice(0, 160);
}

async function assertAdmin(
  supabase: ReturnType<typeof createSupabaseServerClient>
): Promise<{ ok: true } | { ok: false; status: number; body: ApiErr }> {
  const { data, error } = await supabase.auth.getUser();

  const user = data?.user;

  if (error || !user) {
    return {
      ok: false,
      status: 401,
      body: { ok: false, error: "UNAUTHENTICATED" },
    };
  }

  const { data: adminRow, error: adminErr } = await supabase
    .from("admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (adminErr) {
    return {
      ok: false,
      status: 500,
      body: {
        ok: false,
        error: "INTERNAL_ERROR",
        details: isProdEnv() ? undefined : adminErr.message,
      },
    };
  }

  if (!adminRow?.user_id) {
    return {
      ok: false,
      status: 401,
      body: { ok: false, error: "UNAUTHENTICATED" },
    };
  }

  return { ok: true };
}

/**
 * GET
 * - Default: return ALL nodes (needed for tree UI)
 * - If parentId is provided: return only children of that parent
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);

    const parentId = readString(url.searchParams.get("parentId"), 80);
    const includeUnpublished =
      readBool(url.searchParams.get("includeUnpublished")) ?? true;

    const limitRaw = readNumber(url.searchParams.get("limit"));
    const limit =
      limitRaw && limitRaw > 0 ? Math.min(1000, Math.floor(limitRaw)) : 1000;

    const supabase = createSupabaseServerClient();

    const admin = await assertAdmin(supabase);
    if (!admin.ok) return json(admin.status, admin.body);

    let q = supabase
      .from("sections")
      .select("*")
      .order("parent_id", { ascending: true })
      .order("order_index", { ascending: true })
      .limit(limit);

    // Only filter if parentId is explicitly passed
    if (parentId) {
      q = q.eq("parent_id", parentId);
    }

    if (!includeUnpublished) {
      q = q.eq("is_published", true);
    }

    const { data, error } = await q;

    if (error) {
      return json(500, {
        ok: false,
        error: "INTERNAL_ERROR",
        details: isProdEnv() ? undefined : error.message,
      });
    }

    const items = (data ?? []) as Array<Record<string, unknown>>;

    return json(200, { ok: true, items, nodes: items });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error.";
    return json(500, {
      ok: false,
      error: "INTERNAL_ERROR",
      details: isProdEnv() ? undefined : msg,
    });
  }
}

/**
 * POST
 * Accept both:
 * - { title, nodeType: "folder", parentId }
 * - { title, kind, slug, data, orderIndex, isPublished }
 * And snake_case variants too.
 */
export async function POST(req: Request) {
  try {
    const supabase = createSupabaseServerClient();

    const admin = await assertAdmin(supabase);
    if (!admin.ok) return json(admin.status, admin.body);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      body = null;
    }

    if (!isPlainObject(body)) {
      return json(400, { ok: false, error: "Invalid JSON body." });
    }

    const parentId =
      readString(body.parent_id, 80) ||
      readString(body.parentId, 80) ||
      null;

    const title = readString(body.title, 200);

    const nodeType =
      readString(body.node_type, 40) || readString(body.nodeType, 40);

    const kind = readString(body.kind, 80) || nodeType || "section";

    const slugRaw = readString(body.slug, 160);
    const slug =
      slugRaw ||
      (title ? slugify(title) : "");

    const orderIndexRaw =
      readNumber(body.order_index) ?? readNumber(body.orderIndex);
    const orderIndex = orderIndexRaw === null ? 0 : Math.floor(orderIndexRaw);

    const isPublishedRaw =
      readBool(body.is_published) ?? readBool(body.isPublished);

    const isPublished =
      isPublishedRaw === null ? true : isPublishedRaw;

    const data =
      isPlainObject(body.data) ? (body.data as Record<string, unknown>) : {};

    if (!title) {
      return json(400, { ok: false, error: "Field 'title' is required." });
    }

    /**
     * For folders, slug can be optional in UI terms,
     * but table expects something predictable.
     * We auto-generate slug from title.
     */
    if (!slug) {
      return json(400, { ok: false, error: "Unable to generate slug." });
    }

    const payload: Record<string, unknown> = {
      parent_id: parentId,
      slug,
      title,
      kind,
      data,
      order_index: orderIndex,
      is_published: isPublished,
      updated_at: new Date().toISOString(),
    };

    const { data: created, error } = await supabase
      .from("sections")
      .insert(payload)
      .select("*")
      .single();

    if (error) {
      return json(500, {
        ok: false,
        error: "INTERNAL_ERROR",
        details: isProdEnv() ? undefined : error.message,
      });
    }

    const item = (created ?? {}) as Record<string, unknown>;

    return json(201, { ok: true, item, node: item });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error.";
    return json(500, {
      ok: false,
      error: "INTERNAL_ERROR",
      details: isProdEnv() ? undefined : msg,
    });
  }
}

/**
 * Method guards
 */
export async function PUT() {
  return json(405, {
    ok: false,
    error: "METHOD_NOT_ALLOWED",
    details: "Use POST or GET.",
  });
}

export async function PATCH() {
  return PUT();
}

export async function DELETE() {
  return PUT();
}
