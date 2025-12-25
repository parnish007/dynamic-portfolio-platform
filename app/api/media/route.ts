// app/api/media/route.ts
import { NextResponse } from "next/server";
import crypto from "crypto";

export const runtime = "nodejs";

type ApiOk<T> = { ok: true } & T;
type ApiErr = { ok: false; error: string; details?: string };

type MediaListItem = {
  publicId: string;
  secureUrl: string | null;
  url: string | null;

  resourceType: "image" | "video" | "raw";
  format: string | null;

  bytes: number | null;
  width: number | null;
  height: number | null;

  folder: string | null;
  originalFilename: string | null;

  createdAt: string | null;

  // Your admin UI can optionally show these
  requestedFolder: string | null;
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function clampInt(value: string | null, fallback: number, min: number, max: number): number {
  if (!isNonEmptyString(value)) return fallback;
  const n = Number.parseInt(value, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
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
 * Admin protection (MUST be set in prod):
 * - Require MEDIA_UPLOAD_SECRET
 * - Header: x-media-upload-secret: <secret>
 */
function isMediaAdminAuthorized(request: Request): boolean {
  const secret = process.env.MEDIA_UPLOAD_SECRET;
  if (!isNonEmptyString(secret)) {
    return false;
  }
  const header = request.headers.get("x-media-upload-secret");
  if (!isNonEmptyString(header)) return false;
  return header.trim() === secret.trim();
}

/**
 * Best-effort in-memory rate limiter.
 * - GET: 240 req/min/IP
 * - DELETE: 60 req/min/IP
 */
type RateEntry = { tokens: number; lastRefillMs: number };
const RL_KEY_GET = "__portfolio_cloudinary_media_rl_get__";
const RL_KEY_DELETE = "__portfolio_cloudinary_media_rl_delete__";

function getRateStore(key: string): Map<string, RateEntry> {
  const g = globalThis as unknown as Record<string, unknown>;
  if (!(g[key] instanceof Map)) {
    g[key] = new Map<string, RateEntry>();
  }
  return g[key] as Map<string, RateEntry>;
}

function allowRequest(args: {
  key: string;
  ip: string;
  capacity: number;
  windowSeconds: number;
}): { allowed: boolean; retryAfterSeconds?: number } {
  const store = getRateStore(args.key);

  const capacity = args.capacity;
  const refillPerSecond = capacity / args.windowSeconds;

  const now = Date.now();
  const existing = store.get(args.ip);

  if (!existing) {
    store.set(args.ip, { tokens: capacity - 1, lastRefillMs: now });
    return { allowed: true };
  }

  const elapsedSeconds = Math.max(0, (now - existing.lastRefillMs) / 1000);
  const refilled = Math.min(capacity, existing.tokens + elapsedSeconds * refillPerSecond);

  if (refilled < 1) {
    const deficit = 1 - refilled;
    const secondsToWait = Math.ceil(deficit / refillPerSecond);
    store.set(args.ip, { tokens: refilled, lastRefillMs: now });
    return { allowed: false, retryAfterSeconds: secondsToWait };
  }

  store.set(args.ip, { tokens: refilled - 1, lastRefillMs: now });
  return { allowed: true };
}

function err(error: string, status: number, details?: string): Response {
  const payload: ApiErr = { ok: false, error };
  if (isNonEmptyString(details)) {
    payload.details = details.slice(0, 2000);
  }
  return NextResponse.json(payload, { status, headers: { "Cache-Control": "no-store" } });
}

function ok<T extends Record<string, unknown>>(data: T, status = 200): Response {
  const payload: ApiOk<T> = { ok: true, ...data };
  return NextResponse.json(payload, { status, headers: { "Cache-Control": "no-store" } });
}

function getCloudinaryConfig(): { cloudName: string; apiKey: string; apiSecret: string } | null {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME ?? "";
  const apiKey = process.env.CLOUDINARY_API_KEY ?? "";
  const apiSecret = process.env.CLOUDINARY_API_SECRET ?? "";

  if (!isNonEmptyString(cloudName) || !isNonEmptyString(apiKey) || !isNonEmptyString(apiSecret)) {
    return null;
  }

  return {
    cloudName: cloudName.trim(),
    apiKey: apiKey.trim(),
    apiSecret: apiSecret.trim(),
  };
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

  const normalized = parts.join("/").slice(0, 160);

  return normalized.length > 0 ? normalized : "";
}

function cloudinaryFolderFromPrefix(prefixRaw: string | null): string | null {
  const base = isNonEmptyString(process.env.CLOUDINARY_FOLDER_DEFAULT)
    ? String(process.env.CLOUDINARY_FOLDER_DEFAULT).trim().replace(/\/+$/, "")
    : "portfolio";

  const prefix = isNonEmptyString(prefixRaw) ? sanitizeFolder(prefixRaw) : "";
  if (!prefix) return base;

  return `${base}/${prefix}`;
}

function signCloudinary(params: Record<string, string>, apiSecret: string): string {
  const sorted = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");

  return crypto.createHash("sha1").update(sorted + apiSecret).digest("hex");
}

function normalizeResource(row: Record<string, unknown>): MediaListItem | null {
  const publicId = row.public_id;
  if (!isNonEmptyString(publicId)) return null;

  const secureUrl = isNonEmptyString(row.secure_url) ? String(row.secure_url) : null;
  const url = isNonEmptyString(row.url) ? String(row.url) : null;

  const rtRaw = row.resource_type;
  const resourceType: "image" | "video" | "raw" =
    rtRaw === "image" || rtRaw === "video" || rtRaw === "raw" ? rtRaw : "raw";

  const format = isNonEmptyString(row.format) ? String(row.format) : null;

  const bytes = typeof row.bytes === "number" && Number.isFinite(row.bytes) ? row.bytes : null;
  const width = typeof row.width === "number" && Number.isFinite(row.width) ? row.width : null;
  const height = typeof row.height === "number" && Number.isFinite(row.height) ? row.height : null;

  const folder = isNonEmptyString(row.folder) ? String(row.folder) : null;

  const originalFilename = isNonEmptyString(row.original_filename)
    ? String(row.original_filename)
    : null;

  const createdAt = isNonEmptyString(row.created_at) ? String(row.created_at) : null;

  // If you want, you can store your own "requestedFolder" in context/tags later.
  // For now: we can infer "requestedFolder" only if folder includes base prefix.
  const requestedFolder = null;

  return {
    publicId: String(publicId),
    secureUrl,
    url,
    resourceType,
    format,
    bytes,
    width,
    height,
    folder,
    originalFilename,
    createdAt,
    requestedFolder,
  };
}

/**
 * GET /api/media
 * Query params:
 * - prefix: folder under your CLOUDINARY_FOLDER_DEFAULT (example: "uploads/2025/12")
 * - limit: default 50, max 200
 * - nextCursor: cursor string from previous response (Cloudinary next_cursor)
 *
 * Returns:
 * - items
 * - page: { limit, nextCursor }
 */
export async function GET(request: Request): Promise<Response> {
  const ip = getClientIp(request);
  const rate = allowRequest({ key: RL_KEY_GET, ip, capacity: 240, windowSeconds: 60 });

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

  if (!isMediaAdminAuthorized(request)) {
    return err("Unauthorized. Set MEDIA_UPLOAD_SECRET and pass x-media-upload-secret.", 401);
  }

  const cfg = getCloudinaryConfig();
  if (!cfg) {
    return err(
      "Missing Cloudinary configuration.",
      500,
      "Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET.",
    );
  }

  const url = new URL(request.url);

  const prefixRaw = url.searchParams.get("prefix");
  const folder = cloudinaryFolderFromPrefix(prefixRaw);

  const limit = clampInt(url.searchParams.get("limit"), 50, 1, 200);
  const nextCursor = url.searchParams.get("nextCursor");

  // Cloudinary Admin API "resources by prefix" endpoint:
  // GET https://api.cloudinary.com/v1_1/<cloud_name>/resources/by_prefix?prefix=<folder>&max_results=<limit>&next_cursor=<cursor>
  const endpoint = new URL(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cfg.cloudName)}/resources/by_prefix`);
  endpoint.searchParams.set("prefix", folder ?? "");
  endpoint.searchParams.set("max_results", String(limit));
  if (isNonEmptyString(nextCursor)) {
    endpoint.searchParams.set("next_cursor", nextCursor.trim());
  }

  // Basic auth with api_key:api_secret
  const auth = Buffer.from(`${cfg.apiKey}:${cfg.apiSecret}`).toString("base64");

  try {
    const res = await fetch(endpoint.toString(), {
      method: "GET",
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    const text = await res.text();

    if (!res.ok) {
      return err("Failed to list media.", 502, text);
    }

    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      return err("Failed to list media.", 502, "Invalid Cloudinary JSON response.");
    }

    if (!isPlainObject(json)) {
      return err("Failed to list media.", 502, "Unexpected Cloudinary response.");
    }

    const resources = (json as Record<string, unknown>).resources;
    const next = (json as Record<string, unknown>).next_cursor;

    const items = Array.isArray(resources)
      ? resources
          .map((r) => (isPlainObject(r) ? (r as Record<string, unknown>) : null))
          .filter((r): r is Record<string, unknown> => r !== null)
          .map((r) => normalizeResource(r))
          .filter((r): r is MediaListItem => r !== null)
      : [];

    return ok(
      {
        folder,
        page: {
          limit,
          nextCursor: isNonEmptyString(next) ? String(next) : null,
        },
        items,
      },
      200,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error.";
    return err("Unexpected server error.", 500, msg);
  }
}

/**
 * DELETE /api/media
 * Body JSON:
 * - publicId: string (required)  // Cloudinary public_id
 *
 * NOTE:
 * - This uses Cloudinary Admin API destroy endpoint.
 */
export async function DELETE(request: Request): Promise<Response> {
  const ip = getClientIp(request);
  const rate = allowRequest({ key: RL_KEY_DELETE, ip, capacity: 60, windowSeconds: 60 });

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

  if (!isMediaAdminAuthorized(request)) {
    return err("Unauthorized. Set MEDIA_UPLOAD_SECRET and pass x-media-upload-secret.", 401);
  }

  const cfg = getCloudinaryConfig();
  if (!cfg) {
    return err(
      "Missing Cloudinary configuration.",
      500,
      "Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET.",
    );
  }

  let bodyJson: unknown;
  try {
    bodyJson = await request.json();
  } catch {
    return err("Invalid JSON body.", 400);
  }

  if (!isPlainObject(bodyJson)) {
    return err("Invalid JSON body.", 400);
  }

  const publicIdRaw = (bodyJson as Record<string, unknown>).publicId;
  if (!isNonEmptyString(publicIdRaw)) {
    return err("Field 'publicId' is required.", 400);
  }

  const publicId = publicIdRaw.trim();

  // Cloudinary destroy endpoint:
  // POST https://api.cloudinary.com/v1_1/<cloud_name>/image/destroy (or video/raw)
  //
  // To avoid guessing resource_type, we try image -> video -> raw.
  // This is safe and keeps your UI simple.
  const auth = Buffer.from(`${cfg.apiKey}:${cfg.apiSecret}`).toString("base64");

  async function destroyWithType(resourceType: "image" | "video" | "raw"): Promise<Record<string, unknown>> {
    const destroyUrl = `https://api.cloudinary.com/v1_1/${encodeURIComponent(cfg.cloudName)}/${resourceType}/destroy`;

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signParams: Record<string, string> = {
      public_id: publicId,
      timestamp,
    };
    const signature = signCloudinary(signParams, cfg.apiSecret);

    const form = new FormData();
    form.set("public_id", publicId);
    form.set("timestamp", timestamp);
    form.set("api_key", cfg.apiKey);
    form.set("signature", signature);

    const res = await fetch(destroyUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: "application/json",
      },
      body: form,
      cache: "no-store",
    });

    const text = await res.text();

    if (!res.ok) {
      throw new Error(text.slice(0, 2000));
    }

    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error("Invalid Cloudinary JSON response.");
    }

    if (!isPlainObject(json)) {
      throw new Error("Unexpected Cloudinary response.");
    }

    return json as Record<string, unknown>;
  }

  try {
    // Try in order (most common first)
    const attempts: Array<"image" | "video" | "raw"> = ["image", "video", "raw"];

    let lastErr: string | null = null;

    for (const t of attempts) {
      try {
        const out = await destroyWithType(t);
        const result = isNonEmptyString(out.result) ? String(out.result) : null;

        // Cloudinary destroy result examples: "ok", "not found"
        if (result === "ok") {
          return ok({ deleted: { publicId, resourceType: t, result } }, 200);
        }

        if (result === "not found") {
          // Try next type
          lastErr = `not found in ${t}`;
          continue;
        }

        // Other results: treat as success but pass through
        return ok({ deleted: { publicId, resourceType: t, result: result ?? "unknown" } }, 200);
      } catch (e) {
        lastErr = e instanceof Error ? e.message : "Unknown error.";
        // Try next
      }
    }

    return err("Failed to delete media.", 502, lastErr ?? "Unknown error.");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error.";
    return err("Unexpected server error.", 500, msg);
  }
}

export async function POST(): Promise<Response> {
  return err("Method not allowed. Use GET (list) or DELETE (remove) or /media/upload for uploads.", 405);
}

export async function PATCH(): Promise<Response> {
  return err("Method not allowed.", 405);
}
