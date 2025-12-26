// app/api/admin/media/route.ts

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
// Admin Guard (SAFE, consistent with other admin APIs)
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
// GET → Admin media status + optional bucket probe
// =============================================
export async function GET() {
  try {
    const supabase = createSupabaseServerClient();

    const admin = await requireAdmin(supabase);
    if (!admin.ok) {
      return json(admin.status, { ok: false, error: admin.error });
    }

    /**
     * IMPORTANT:
     * We keep this endpoint "readiness-first" to avoid breaking any existing
     * media pipeline. Your actual upload endpoint is /api/media/upload.
     *
     * Optional: probe storage for a bucket if you want. This is safe and does
     * not list or expose files by default.
     */
    const bucketName = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET ?? "media";

    // Probe bucket list (safe; if permissions block, we still return READY)
    let storageProbe: { ok: boolean; bucket?: string; error?: string } = {
      ok: true,
      bucket: bucketName,
    };

    try {
      const { data, error } = await supabase.storage.listBuckets();
      if (error) {
        storageProbe = { ok: false, bucket: bucketName, error: error.message };
      } else {
        const exists = (data ?? []).some((b) => b.name === bucketName);
        storageProbe = exists
          ? { ok: true, bucket: bucketName }
          : {
              ok: false,
              bucket: bucketName,
              error: `Bucket "${bucketName}" not found.`,
            };
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      storageProbe = { ok: false, bucket: bucketName, error: msg };
    }

    return json(200, {
      ok: true,
      status: "READY",
      media: {
        bucket: bucketName,
        uploadEndpoint: "/api/media/upload",
        note:
          "This is the admin media controller endpoint. Use /api/media/upload for uploads.",
      },
      storageProbe,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return json(500, { ok: false, error: msg });
  }
}

// =============================================
// POST → Reserved (future: create folders, register metadata)
// =============================================
export async function POST() {
  return json(405, {
    ok: false,
    error: "METHOD_NOT_ALLOWED",
    hint: "Use /api/media/upload for uploads. Admin media CRUD comes next.",
  });
}

// =============================================
// PATCH / DELETE Guards
// =============================================
export async function PATCH() {
  return json(405, { ok: false, error: "METHOD_NOT_ALLOWED" });
}

export async function DELETE() {
  return json(405, { ok: false, error: "METHOD_NOT_ALLOWED" });
}
