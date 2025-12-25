// ============================================
// Capitalize First Letter
// ============================================

export const capitalize = (
  value?: string | null
) => {

  if (!value) return "";

  const trimmed = value.trim();

  if (trimmed.length === 0) return "";

  return (
    trimmed.charAt(0).toUpperCase() +
    trimmed.slice(1)
  );
};


// ============================================
// Capitalize Each Word
// ============================================

export const capitalizeWords = (
  value?: string | null
) => {

  if (!value) return "";

  return value
    .split(" ")
    .filter(Boolean)
    .map((word) => {
      return (
        word.charAt(0).toUpperCase() +
        word.slice(1)
      );
    })
    .join(" ");
};
