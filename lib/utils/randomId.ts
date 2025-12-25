// ============================================
// Generate Random ID
// ============================================

export type RandomIdOptions = {
  length?: number;
  prefix?: string;
};

export const randomId = (
  options?: RandomIdOptions
) => {

  const length = Math.max(6, options?.length ?? 12);

  const prefix = options?.prefix
    ? `${options.prefix}_`
    : "";

  const chars =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

  let id = "";

  for (let i = 0; i < length; i++) {
    id += chars.charAt(
      Math.floor(Math.random() * chars.length)
    );
  }

  return `${prefix}${id}`;
};


// ============================================
// UUID v4 (Crypto-safe)
// ============================================

export const uuidv4 = () => {

  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  // Fallback (RFC 4122 compliant)
  let uuid = "";
  const chars = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx";

  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];

    if (c === "x" || c === "y") {
      const r = Math.random() * 16 | 0;
      const v = c === "x" ? r : (r & 0x3 | 0x8);
      uuid += v.toString(16);
    } else {
      uuid += c;
    }
  }

  return uuid;
};
