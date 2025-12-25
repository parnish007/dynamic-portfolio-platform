// app/api/media/upload/route.ts
import { NextResponse } from "next/server";
import crypto from "crypto";

export const runtime = "nodejs";

type UploadResult = {
  ok: true;
  file: {
    path: string;
    url: string | null;
    bucket: string;
    mime: string;
    size: number;
    width: number | null;
    height: number | null;
    originalName: string | null;
    uploadedAt: string;
    meta: Record<string, unknown> | null;
  };
};

type UploadError = {
  ok: false;
  error: string;
  details?: string;
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sanitizeFilename(name: string): string {
  const base = name.replaceAll("\\", "/").split("/").pop() ?? "file";
  const cleaned = base
    .replace(/[^\w.\-()+\s]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 120);

  return cleaned.length > 0 ? cleaned : "file";
}

function extFromName(name: string): string | null {
  const idx = name.lastIndexOf(".");
  if (idx < 0) return null;
  const ext = name.slice(idx + 1).toLowerCase().trim();
  if (!ext) return null;
  if (!/^[a-z0-9]{1,10}$/.test(ext)) return null;
  return ext;
}

function guessExtFromMime(mime: string): string | null {
  const m = mime.toLowerCase();
  if (m === "image/jpeg") return "jpg";
  if (m === "image/png") return "png";
  if (m === "image/webp") return "webp";
  if (m === "image/gif") return "gif";
  if (m === "image/svg+xml") return "svg";
  if (m === "application/pdf") return "pdf";
  if (m === "text/plain") return "txt";
  if (m === "text/markdown") return "md";
  if (m === "application/zip") return "zip";
  return null;
}

function getClientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (isNonEmptyString(xff)) {
    const first = xff.split(",")[0]?.trim();
    if (isNonEmptyString(first)) return first;
  }
  const xRealIp = request.headers.get("x-real-ip");
  if (isNonEmptyString(xRealIp)) return xRealIp.trim();
  return "unknown";
}

/**
 * Rate limit (in-memory, best-effort).
 * - 30 uploads per minute per IP
 */
type RateEntry = { tokens: number; lastRefillMs: number };
const RL_KEY = "__portfolio_media_upload_rl__";

function getRateStore(): Map<string, RateEntry> {
  const g = globalThis as unknown as Record<string, unknown>;
  if (!(g[RL_KEY] instanceof Map)) {
    g[RL_KEY] = new Map<string, RateEntry>();
  }
  return g[RL_KEY] as Map<string, RateEntry>;
}

function allowUpload(ip: string): { allowed: boolean; retryAfterSeconds?: number } {
  const store = getRateStore();

  const capacity = 30;
  const refillPerSecond = capacity / 60;

  const now = Date.now();
  const existing = store.get(ip);

  if (!existing) {
    store.set(ip, { tokens: capacity - 1, lastRefillMs: now });
    return { allowed: true };
  }

  const elapsedSeconds = Math.max(0, (now - existing.lastRefillMs) / 1000);
  const refilled = Math.min(capacity, existing.tokens + elapsedSeconds * refillPerSecond);

  if (refilled < 1) {
    const deficit = 1 - refilled;
    const secondsToWait = Math.ceil(deficit / refillPerSecond);
    store.set(ip, { tokens: refilled, lastRefillMs: now });
    return { allowed: false, retryAfterSeconds: secondsToWait };
  }

  store.set(ip, { tokens: refilled - 1, lastRefillMs: now });
  return { allowed: true };
}

/**
 * Upload auth (admin-only).
 * MUST set MEDIA_UPLOAD_SECRET in production.
 */
function isUploadAuthorized(request: Request): boolean {
  const secret = process.env.MEDIA_UPLOAD_SECRET;

  if (!isNonEmptyString(secret)) {
    return false;
  }

  const header = request.headers.get("x-media-upload-secret");
  if (!isNonEmptyString(header)) {
    return false;
  }

  return header.trim() === secret.trim();
}

function getSupabaseConfig(): { url: string; serviceKey: string; bucket: string } | null {
  const url =
    process.env.SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_URL ??
    "";

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  const bucket = isNonEmptyString(process.env.SUPABASE_MEDIA_BUCKET)
    ? String(process.env.SUPABASE_MEDIA_BUCKET).trim()
    : "media";

  if (!isNonEmptyString(url) || !isNonEmptyString(serviceKey)) {
    return null;
  }

  return { url: String(url).trim().replace(/\/$/, ""), serviceKey: String(serviceKey).trim(), bucket };
}

function getPublicBaseUrl(): string | null {
  const url =
    process.env.SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_URL ??
    "";

  if (!isNonEmptyString(url)) return null;
  return String(url).trim().replace(/\/$/, "");
}

function sanitizeFolder(input: string): string {
  const raw = input.trim().replaceAll("\\", "/");

  const parts = raw
    .split("/")
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .filter((p) => p !== "." && p !== "..")
    .map((p) => p.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 40))
    .filter((p) => p.length > 0);

  const normalized = parts.join("/").slice(0, 120);

  return normalized.length > 0 ? normalized : "uploads";
}

function buildObjectPath(args: {
  folder: string;
  originalName: string | null;
  mime: string;
}): { path: string; originalName: string | null } {
  const folder = sanitizeFolder(args.folder);
  const original = args.originalName ? sanitizeFilename(args.originalName) : null;

  const extFromOriginal = original ? extFromName(original) : null;
  const extFromMimeGuess = guessExtFromMime(args.mime);
  const ext = extFromOriginal ?? extFromMimeGuess ?? "bin";

  const date = new Date();
  const y = String(date.getUTCFullYear());
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");

  const rand = crypto.randomBytes(10).toString("hex");

  const safeBaseName = original ? original.replace(/\.[^.]+$/, "").slice(0, 60) : "upload";
  const fileName = `${safeBaseName}-${rand}.${ext}`.replace(/\s+/g, "-");

  const finalPath = `${folder}/${y}/${m}/${d}/${fileName}`.replace(/\/+/g, "/");

  return { path: finalPath, originalName: original };
}

async function readImageDimensions(file: File): Promise<{ width: number; height: number } | null> {
  void file;
  return null;
}

function okJson(data: UploadResult, status: number): Response {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

function errJson(error: string, status: number, details?: string): Response {
  const payload: UploadError = { ok: false, error };
  if (isNonEmptyString(details)) {
    payload.details = details.slice(0, 2000);
  }
  return NextResponse.json(payload, { status, headers: { "Cache-Control": "no-store" } });
}

function shouldReturnPublicUrl(): boolean {
  const env = process.env.MEDIA_UPLOAD_RETURN_PUBLIC_URL;
  if (!isNonEmptyString(env)) {
    return false;
  }
  const v = env.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

export async function POST(request: Request): Promise<Response> {
  const ip = getClientIp(request);
  const rate = allowUpload(ip);

  if (!rate.allowed) {
    const retryAfter = rate.retryAfterSeconds ?? 60;
    return new NextResponse(JSON.stringify({ ok: false, error: "Too many requests." }), {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(retryAfter),
        "Cache-Control": "no-store",
      },
    });
  }

  if (!isUploadAuthorized(request)) {
    return errJson("Unauthorized. Set MEDIA_UPLOAD_SECRET and pass x-media-upload-secret.", 401);
  }

  const cfg = getSupabaseConfig();
  if (!cfg) {
    return errJson(
      "Missing Supabase configuration. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
      500,
    );
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("multipart/form-data")) {
    return errJson("Expected multipart/form-data.", 415);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return errJson("Failed to read multipart form data.", 400);
  }

  const fileValue = form.get("file");
  if (!(fileValue instanceof File)) {
    return errJson("Missing form field 'file'.", 400);
  }

  const folderValue = form.get("folder");
  const requestedFolder = isNonEmptyString(folderValue) ? folderValue : "uploads";

  const maxBytes = (() => {
    const env = process.env.MEDIA_UPLOAD_MAX_BYTES;
    if (!isNonEmptyString(env)) return 10 * 1024 * 1024;
    const n = Number.parseInt(env, 10);
    if (Number.isNaN(n)) return 10 * 1024 * 1024;
    return Math.min(50 * 1024 * 1024, Math.max(256 * 1024, n));
  })();

  if (fileValue.size > maxBytes) {
    return errJson(`File too large. Max ${(maxBytes / (1024 * 1024)).toFixed(1)}MB.`, 413);
  }

  const mime = isNonEmptyString(fileValue.type) ? fileValue.type : "application/octet-stream";

  const allowList = (() => {
    const env = process.env.MEDIA_UPLOAD_ALLOWED_MIME;
    if (!isNonEmptyString(env)) return null;
    return env
      .split(",")
      .map((x) => x.trim().toLowerCase())
      .filter((x) => x.length > 0);
  })();

  if (allowList && allowList.length > 0) {
    const allowed = allowList.includes(mime.toLowerCase());
    if (!allowed) {
      return errJson("File type not allowed.", 415, `mime=${mime}`);
    }
  }

  const metaRaw = form.get("meta");
  let meta: Record<string, unknown> | null = null;

  if (typeof metaRaw === "string" && isNonEmptyString(metaRaw)) {
    try {
      const parsed: unknown = JSON.parse(metaRaw);
      if (isPlainObject(parsed)) {
        meta = parsed;
      }
    } catch {
      // ignore
    }
  }

  const { path, originalName } = buildObjectPath({
    folder: requestedFolder,
    originalName: fileValue.name,
    mime,
  });

  let arrayBuffer: ArrayBuffer;
  try {
    arrayBuffer = await fileValue.arrayBuffer();
  } catch {
    return errJson("Failed to read file bytes.", 400);
  }

  const bytes = new Uint8Array(arrayBuffer);

  // ✅ Correct Storage upload:
  // PUT /storage/v1/object/<bucket>/<path> with x-upsert true
  const putUrl = `${cfg.url}/storage/v1/object/${encodeURIComponent(cfg.bucket)}/${path
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/")}`;

  try {
    const putRes = await fetch(putUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${cfg.serviceKey}`,
        apikey: cfg.serviceKey,
        "Content-Type": mime,
        "x-upsert": "true",
      },
      body: bytes,
      cache: "no-store",
    });

    if (!putRes.ok) {
      const text = await putRes.text();
      return errJson("Upload failed.", 502, text);
    }

    const dims = await readImageDimensions(fileValue);

    const base = getPublicBaseUrl();
    const publicUrl =
      shouldReturnPublicUrl() && base
        ? `${base}/storage/v1/object/public/${encodeURIComponent(cfg.bucket)}/${path
            .split("/")
            .map((seg) => encodeURIComponent(seg))
            .join("/")}`
        : null;

    return okJson(
      {
        ok: true,
        file: {
          path,
          url: publicUrl,
          bucket: cfg.bucket,
          mime,
          size: fileValue.size,
          width: dims ? dims.width : null,
          height: dims ? dims.height : null,
          originalName,
          uploadedAt: new Date().toISOString(),
          meta,
        },
      },
      201,
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error.";
    return errJson("Unexpected server error.", 500, msg);
  }
}

export async function GET(): Promise<Response> {
  return errJson("Method not allowed. Use POST.", 405);
}

export async function DELETE(): Promise<Response> {
  return errJson("Method not allowed.", 405);
}
