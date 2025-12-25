// lib/cloudinary.ts
import crypto from "crypto";

type CloudinaryConfig = {
  cloudName: string;
  apiKey: string;
  apiSecret: string;

  // Optional: default folder prefix for your whole app
  defaultFolder: string;

  // Optional: allow unsigned uploads (NOT recommended for admin CMS)
  uploadPreset: string | null;
};

export type CloudinaryResourceType = "image" | "video" | "raw";

export type CloudinaryUploadOptions = {
  folder?: string;
  publicId?: string;

  resourceType?: CloudinaryResourceType;

  tags?: string[];

  // Cloudinary "context" (key=value|key2=value2)
  context?: Record<string, string>;

  // If you want deterministic transforms on upload:
  // e.g. "f_auto,q_auto"
  eager?: string;

  overwrite?: boolean;
};

export type CloudinaryUploadResult = {
  publicId: string;
  version: number | null;
  signature: string | null;

  width: number | null;
  height: number | null;
  bytes: number | null;
  format: string | null;

  resourceType: CloudinaryResourceType;

  url: string | null;
  secureUrl: string | null;

  originalFilename: string | null;
  createdAt: string | null;
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function sanitizeFolder(input: string): string {
  const raw = input.trim().replaceAll("\\", "/");

  const parts = raw
    .split("/")
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .filter((p) => p !== "." && p !== "..")
    .map((p) => p.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 60))
    .filter((p) => p.length > 0);

  return parts.join("/").slice(0, 200);
}

function toContextString(context: Record<string, string> | undefined): string | null {
  if (!context) return null;
  const entries = Object.entries(context)
    .map(([k, v]) => [k.trim(), v.trim()])
    .filter(([k, v]) => k.length > 0 && v.length > 0);

  if (entries.length === 0) return null;

  // Cloudinary expects: "key=value|key2=value2"
  return entries.map(([k, v]) => `${k}=${v}`).join("|");
}

export function getCloudinaryConfig(): CloudinaryConfig | null {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME ?? "";
  const apiKey = process.env.CLOUDINARY_API_KEY ?? "";
  const apiSecret = process.env.CLOUDINARY_API_SECRET ?? "";

  const defaultFolderRaw = process.env.CLOUDINARY_FOLDER_DEFAULT ?? "portfolio";
  const uploadPresetRaw = process.env.CLOUDINARY_UPLOAD_PRESET ?? "";

  if (!isNonEmptyString(cloudName) || !isNonEmptyString(apiKey) || !isNonEmptyString(apiSecret)) {
    return null;
  }

  return {
    cloudName: cloudName.trim(),
    apiKey: apiKey.trim(),
    apiSecret: apiSecret.trim(),
    defaultFolder: sanitizeFolder(defaultFolderRaw.trim()) || "portfolio",
    uploadPreset: isNonEmptyString(uploadPresetRaw) ? uploadPresetRaw.trim() : null,
  };
}

export function buildCloudinaryPublicUrl(args: {
  cloudName: string;
  publicId: string;
  resourceType?: CloudinaryResourceType;
  // Optional transformation string like "f_auto,q_auto,w_1200"
  transform?: string;
  // Optional extension (if you want a forced format)
  ext?: string;
}): string {
  const rt = args.resourceType ?? "image";
  const tr = isNonEmptyString(args.transform) ? `${args.transform.replace(/^\/+|\/+$/g, "")}/` : "";
  const ext = isNonEmptyString(args.ext) ? `.${args.ext.trim().replace(/^\./, "")}` : "";
  const pid = args.publicId.replace(/^\/+/, "");
  return `https://res.cloudinary.com/${args.cloudName}/${rt}/upload/${tr}${pid}${ext}`;
}

/**
 * Cloudinary signature for signed uploads / destroy / etc.
 * Signature is sha1 of sorted params joined with "&" plus apiSecret.
 */
export function signCloudinaryParams(
  params: Record<string, string | number | boolean | null | undefined>,
  apiSecret: string,
): string {
  const filtered: Record<string, string> = {};

  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    const s = String(v);
    if (!isNonEmptyString(s)) continue;
    filtered[k] = s;
  }

  const toSign = Object.keys(filtered)
    .sort()
    .map((k) => `${k}=${filtered[k]}`)
    .join("&");

  return crypto.createHash("sha1").update(toSign + apiSecret).digest("hex");
}

/**
 * Helper to normalize your folder choice:
 * - Always prefixes with CLOUDINARY_FOLDER_DEFAULT
 * - Sanitizes slashes
 */
export function buildCloudinaryFolder(args: { baseFolder: string; subFolder?: string }): string {
  const base = sanitizeFolder(args.baseFolder) || "portfolio";
  const sub = isNonEmptyString(args.subFolder) ? sanitizeFolder(args.subFolder) : "";

  if (!sub) return base;
  return `${base}/${sub}`.replace(/\/+/g, "/");
}

/**
 * For API routes: create a signed payload for direct upload
 * (useful if you ever want "client -> cloudinary" uploads).
 *
 * NOTE:
 * In your current setup, you'll likely upload from server route
 * (admin-only) which is safest.
 */
export function createSignedUploadFields(args: {
  apiKey: string;
  apiSecret: string;
  timestamp?: number;

  folder?: string;
  publicId?: string;

  resourceType?: CloudinaryResourceType;

  tags?: string[];
  context?: Record<string, string>;

  overwrite?: boolean;
  eager?: string;
}): { fields: Record<string, string>; resourceType: CloudinaryResourceType } {
  const timestamp = args.timestamp ?? Math.floor(Date.now() / 1000);

  const resourceType: CloudinaryResourceType = args.resourceType ?? "image";

  const folder = isNonEmptyString(args.folder) ? sanitizeFolder(args.folder) : null;

  const tags = Array.isArray(args.tags) && args.tags.length > 0
    ? args.tags.map((t) => t.trim()).filter((t) => t.length > 0).slice(0, 20)
    : null;

  const contextStr = toContextString(args.context);

  // Params used for signature (must match fields)
  const signParams: Record<string, string | number | boolean | null | undefined> = {
    timestamp,
    folder: folder ?? undefined,
    public_id: isNonEmptyString(args.publicId) ? args.publicId.trim() : undefined,
    tags: tags ? tags.join(",") : undefined,
    context: contextStr ?? undefined,
    overwrite: args.overwrite === true ? "true" : undefined,
    eager: isNonEmptyString(args.eager) ? args.eager.trim() : undefined,
  };

  const signature = signCloudinaryParams(signParams, args.apiSecret);

  const fields: Record<string, string> = {
    api_key: args.apiKey,
    timestamp: String(timestamp),
    signature,
  };

  if (folder) fields.folder = folder;
  if (isNonEmptyString(args.publicId)) fields.public_id = args.publicId.trim();
  if (tags) fields.tags = tags.join(",");
  if (contextStr) fields.context = contextStr;
  if (args.overwrite === true) fields.overwrite = "true";
  if (isNonEmptyString(args.eager)) fields.eager = args.eager.trim();

  return { fields, resourceType };
}

/**
 * Server-side upload using Cloudinary "upload" endpoint.
 * Use this in your /api/media/upload route if you want server-to-cloud uploads.
 *
 * NOTE:
 * This expects a File/Blob-like input as ArrayBuffer/Uint8Array.
 */
export async function cloudinaryUploadBytes(args: {
  cloudName: string;
  apiKey: string;
  apiSecret: string;

  bytes: Uint8Array;
  mime: string;

  options?: CloudinaryUploadOptions;
}): Promise<CloudinaryUploadResult> {
  const resourceType: CloudinaryResourceType = args.options?.resourceType ?? "image";

  const timestamp = Math.floor(Date.now() / 1000);

  const folder = isNonEmptyString(args.options?.folder) ? sanitizeFolder(args.options!.folder!) : null;
  const publicId = isNonEmptyString(args.options?.publicId) ? args.options!.publicId!.trim() : null;

  const tags = Array.isArray(args.options?.tags) && args.options!.tags!.length > 0
    ? args.options!.tags!.map((t) => t.trim()).filter((t) => t.length > 0).slice(0, 20)
    : null;

  const contextStr = toContextString(args.options?.context);

  const overwrite = args.options?.overwrite === true;

  const eager = isNonEmptyString(args.options?.eager) ? args.options!.eager!.trim() : null;

  const signParams: Record<string, string | number | boolean | null | undefined> = {
    timestamp,
    folder: folder ?? undefined,
    public_id: publicId ?? undefined,
    tags: tags ? tags.join(",") : undefined,
    context: contextStr ?? undefined,
    overwrite: overwrite ? "true" : undefined,
    eager: eager ?? undefined,
  };

  const signature = signCloudinaryParams(signParams, args.apiSecret);

  const form = new FormData();

  // Upload bytes as a Blob (Node 18+ / Next runtime supports this)
  const blob = new Blob([args.bytes], { type: args.mime });

  form.set("file", blob);
  form.set("api_key", args.apiKey);
  form.set("timestamp", String(timestamp));
  form.set("signature", signature);

  if (folder) form.set("folder", folder);
  if (publicId) form.set("public_id", publicId);
  if (tags) form.set("tags", tags.join(","));
  if (contextStr) form.set("context", contextStr);
  if (overwrite) form.set("overwrite", "true");
  if (eager) form.set("eager", eager);

  const endpoint = `https://api.cloudinary.com/v1_1/${encodeURIComponent(args.cloudName)}/${resourceType}/upload`;

  const res = await fetch(endpoint, {
    method: "POST",
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

  const row = json as Record<string, unknown>;

  const out: CloudinaryUploadResult = {
    publicId: isNonEmptyString(row.public_id) ? String(row.public_id) : "",
    version: typeof row.version === "number" ? row.version : null,
    signature: isNonEmptyString(row.signature) ? String(row.signature) : null,

    width: typeof row.width === "number" ? row.width : null,
    height: typeof row.height === "number" ? row.height : null,
    bytes: typeof row.bytes === "number" ? row.bytes : null,
    format: isNonEmptyString(row.format) ? String(row.format) : null,

    resourceType: (row.resource_type === "image" || row.resource_type === "video" || row.resource_type === "raw")
      ? row.resource_type
      : resourceType,

    url: isNonEmptyString(row.url) ? String(row.url) : null,
    secureUrl: isNonEmptyString(row.secure_url) ? String(row.secure_url) : null,

    originalFilename: isNonEmptyString(row.original_filename) ? String(row.original_filename) : null,
    createdAt: isNonEmptyString(row.created_at) ? String(row.created_at) : null,
  };

  return out;
}
