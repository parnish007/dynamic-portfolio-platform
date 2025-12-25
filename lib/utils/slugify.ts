// ============================================
// Types
// ============================================

export type SlugifyOptions = {
  lowercase?: boolean;
  maxLength?: number;

  // Comment
  // If true, keeps unicode letters/numbers (e.g., नेपाली words).
  // If false, converts to ASCII-only (best for strict URLs).
  allowUnicode?: boolean;

  replacement?: string;
};


// ============================================
// Helpers
// ============================================

const clamp = (
  value: number,
  min: number,
  max: number
) => {
  return Math.max(min, Math.min(max, value));
};

const toAscii = (
  input: string
) => {

  // Comment
  // Remove accents: "Café" -> "Cafe"

  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
};


// ============================================
// Slugify
// ============================================

export const slugify = (
  input: string,
  options?: SlugifyOptions
) => {

  if (!input) return "";

  const replacement = options?.replacement ?? "-";

  const lowercase = options?.lowercase ?? true;

  const maxLength =
    clamp(options?.maxLength ?? 80, 10, 200);

  let text = input.trim();

  if (!options?.allowUnicode) {
    text = toAscii(text);
  }

  if (lowercase) {
    text = text.toLowerCase();
  }

  // Comment
  // Replace any kind of whitespace with replacement
  text = text.replace(/\s+/g, replacement);

  // Comment
  // Remove invalid characters:
  // - If unicode allowed: keep letters/numbers from all scripts + "-" + "_"
  // - If not: keep ascii letters/numbers + "-" + "_"

  if (options?.allowUnicode) {
    text = text.replace(/[^\p{L}\p{N}\-_]+/gu, replacement);
  } else {
    text = text.replace(/[^a-z0-9\-_]+/g, replacement);
  }

  // Comment
  // Collapse duplicate replacements

  const escaped = replacement.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const dup = new RegExp(`${escaped}{2,}`, "g");

  text = text.replace(dup, replacement);

  // Comment
  // Trim replacement from start/end

  const trimEdges = new RegExp(`^${escaped}+|${escaped}+$`, "g");

  text = text.replace(trimEdges, "");

  // Comment
  // Enforce max length

  if (text.length > maxLength) {
    text = text.slice(0, maxLength);
    text = text.replace(trimEdges, "");
  }

  return text;
};


// ============================================
// Ensure Slug (Fallback if Empty)
// ============================================

export const ensureSlug = (
  input: string,
  fallback = "untitled",
  options?: SlugifyOptions
) => {

  const s = slugify(input, options);

  if (s) return s;

  return slugify(fallback, options);
};
