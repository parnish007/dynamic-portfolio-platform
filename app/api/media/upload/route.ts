// app/api/media/upload/route.ts
import { NextResponse } from "next/server";
import crypto from "crypto";

export const runtime = "nodejs";

type CloudinaryUploadApiOk = {
  ok: true;
  file: {
    publicId: string;
    secureUrl: string;
    url: string;
    resourceType: "image" | "video" | "raw";
    format: string | null;
    bytes: number;
    width: number | null;
    height: number | null;
    originalFilename: string | null;
    folder: string | null;
    createdAt: string | null;

    // Extra: your app-side info
    requestedFolder: string;
    path: string; // app logical path (folder/yyyy/mm/dd/name-rand.ext)
    mime: string;
    size: number;
    uploadedAt: string;
    meta: Record<string, unknown> | null;
  };
};

type CloudinaryUploadApiErr = {
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
const RL_KEY = "__portfolio_cloudinary_upload_rl__";

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

function buildLogicalPath(args: {
  folder: string;
  originalName: string | null;
  mime: string;
}): { path: string; originalName: string | null; folder: string } {
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

  return { path: finalPath, originalName: original, folder };
}

function jsonOk(data: CloudinaryUploadApiOk, status: number): Response {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

function jsonErr(error: string, status: number, details?: string): Response {
  const payload: CloudinaryUploadApiErr = { ok: false, error };
  if (isNonEmptyString(details)) {
    payload.details = details.slice(0, 2000);
  }
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

function cloudinaryFolderFromRequestedFolder(requestedFolder: string): string {
  // You can choose any convention here. This keeps your folder tree inside Cloudinary.
  // Example: "uploads/2025/12/26"
  const base = isNonEmptyString(process.env.CLOUDINARY_FOLDER_DEFAULT)
    ? String(process.env.CLOUDINARY_FOLDER_DEFAULT).trim().replace(/\/+$/, "")
    : "portfolio";

  const req = sanitizeFolder(requestedFolder).replace(/^\/+/, "").replace(/\/+$/, "");
  return req ? `${base}/${req}` : base;
}

function resourceTypeFromMime(mime: string): "image" | "video" | "raw" {
  const m = mime.toLowerCase();
  if (m.startsWith("image/")) return "image";
  if (m.startsWith("video/")) return "video";
  return "raw";
}

function signCloudinary(params: Record<string, string>, apiSecret: string): string {
  // Cloudinary signature: sha1 of sorted params query string + api_secret
  const sorted = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");

  return crypto.createHash("sha1").update(sorted + apiSecret).digest("hex");
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
    return jsonErr("Unauthorized. Set MEDIA_UPLOAD_SECRET and pass x-media-upload-secret.", 401);
  }

  const cfg = getCloudinaryConfig();
  if (!cfg) {
    return jsonErr(
      "Missing Cloudinary configuration.",
      500,
      "Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET.",
    );
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("multipart/form-data")) {
    return jsonErr("Expected multipart/form-data.", 415);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonErr("Failed to read multipart form data.", 400);
  }

  const fileValue = form.get("file");
  if (!(fileValue instanceof File)) {
    return jsonErr("Missing form field 'file'.", 400);
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
    return jsonErr(`File too large. Max ${(maxBytes / (1024 * 1024)).toFixed(1)}MB.`, 413);
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
      return jsonErr("File type not allowed.", 415, `mime=${mime}`);
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

  const { path, originalName } = buildLogicalPath({
    folder: requestedFolder,
    originalName: fileValue.name,
    mime,
  });

  const cloudinaryFolder = cloudinaryFolderFromRequestedFolder(requestedFolder);
  const resourceType = resourceTypeFromMime(mime);

  // Cloudinary upload endpoint:
  // POST https://api.cloudinary.com/v1_1/<cloud_name>/<resource_type>/upload
  const uploadUrl = `https://api.cloudinary.com/v1_1/${encodeURIComponent(cfg.cloudName)}/${resourceType}/upload`;

  // We'll upload using multipart form.
  // Signature is required because we use api_secret on server.
  const timestamp = Math.floor(Date.now() / 1000).toString();

  // Keep original file name as public_id base (optional)
  const safeBase = sanitizeFilename(fileValue.name).replace(/\.[^.]+$/, "").slice(0, 80);
  const rand = crypto.randomBytes(8).toString("hex");
  const publicIdBase = safeBase ? `${safeBase}-${rand}` : `upload-${rand}`;

  const signParams: Record<string, string> = {
    folder: cloudinaryFolder,
    public_id: publicIdBase,
    timestamp,
    // OPTIONAL: keep it private in Cloudinary until you want (default is fine)
    // type: "upload",
    // OPTIONAL: tags
    // tags: "portfolio",
  };

  const signature = signCloudinary(signParams, cfg.apiSecret);

  const uploadForm = new FormData();
  uploadForm.set("file", fileValue);
  uploadForm.set("api_key", cfg.apiKey);
  uploadForm.set("timestamp", timestamp);
  uploadForm.set("signature", signature);
  uploadForm.set("folder", cloudinaryFolder);
  uploadForm.set("public_id", publicIdBase);

  // OPTIONAL: store meta as context (Cloudinary context must be key=value|key=value)
  // If you want it, set MEDIA_UPLOAD_SEND_CONTEXT=true and pack selected keys.
  // For now, keep it simple and do NOT send arbitrary meta to Cloudinary.

  try {
    const res = await fetch(uploadUrl, {
      method: "POST",
      body: uploadForm,
      cache: "no-store",
    });

    const text = await res.text();

    if (!res.ok) {
      return jsonErr("Upload failed.", 502, text);
    }

    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      return jsonErr("Upload failed.", 502, "Invalid Cloudinary JSON response.");
    }

    if (!isPlainObject(json)) {
      return jsonErr("Upload failed.", 502, "Unexpected Cloudinary response.");
    }

    const publicId = isNonEmptyString(json.public_id) ? String(json.public_id) : null;
    const secureUrl = isNonEmptyString(json.secure_url) ? String(json.secure_url) : null;
    const url = isNonEmptyString(json.url) ? String(json.url) : null;

    if (!publicId || !secureUrl || !url) {
      return jsonErr("Upload failed.", 502, "Missing public_id/url in response.");
    }

    const width = typeof json.width === "number" && Number.isFinite(json.width) ? json.width : null;
    const height = typeof json.height === "number" && Number.isFinite(json.height) ? json.height : null;

    const bytes =
      typeof json.bytes === "number" && Number.isFinite(json.bytes) ? json.bytes : fileValue.size;

    const format = isNonEmptyString(json.format) ? String(json.format) : null;
    const createdAt = isNonEmptyString(json.created_at) ? String(json.created_at) : null;
    const folderOut = isNonEmptyString(json.folder) ? String(json.folder) : cloudinaryFolder;

    const originalFilename = isNonEmptyString(json.original_filename)
      ? String(json.original_filename)
      : originalName;

    return jsonOk(
      {
        ok: true,
        file: {
          publicId,
          secureUrl,
          url,
          resourceType,
          format,
          bytes,
          width,
          height,
          originalFilename,
          folder: folderOut,
          createdAt,

          requestedFolder: sanitizeFolder(String(requestedFolder)),
          path,
          mime,
          size: fileValue.size,
          uploadedAt: new Date().toISOString(),
          meta,
        },
      },
      201,
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error.";
    return jsonErr("Unexpected server error.", 500, msg);
  }
}

export async function GET(): Promise<Response> {
  return jsonErr("Method not allowed. Use POST.", 405);
}

export async function DELETE(): Promise<Response> {
  return jsonErr("Method not allowed.", 405);
}
