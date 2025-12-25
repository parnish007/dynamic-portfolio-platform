// ============================================
// Types
// ============================================

export type TruncateOptions = {
  length?: number;

  // Comment
  // If true, cuts exactly at length.
  // If false, preserves whole words.
  hardCut?: boolean;

  ellipsis?: string;
};


// ============================================
// Truncate String
// ============================================

export const truncate = (
  value?: string | null,
  options?: TruncateOptions
) => {

  if (!value) return "";

  const text = value.trim();

  if (!text) return "";

  const maxLength = Math.max(5, options?.length ?? 100);

  const ellipsis = options?.ellipsis ?? "…";

  if (text.length <= maxLength) {
    return text;
  }

  // ------------------------------------------
  // Hard cut (exact length)
  // ------------------------------------------

  if (options?.hardCut) {
    return (
      text.slice(0, maxLength).trimEnd() + ellipsis
    );
  }

  // ------------------------------------------
  // Word-safe cut
  // ------------------------------------------

  const sliced = text.slice(0, maxLength + 1);

  const lastSpace = sliced.lastIndexOf(" ");

  if (lastSpace === -1) {
    return text.slice(0, maxLength).trimEnd() + ellipsis;
  }

  return (
    sliced.slice(0, lastSpace).trimEnd() + ellipsis
  );
};


// ============================================
// Truncate by Words
// ============================================

export const truncateWords = (
  value?: string | null,
  wordCount = 20,
  ellipsis = "…"
) => {

  if (!value) return "";

  const words = value.trim().split(/\s+/);

  if (words.length <= wordCount) {
    return value.trim();
  }

  return (
    words.slice(0, wordCount).join(" ") + ellipsis
  );
};
