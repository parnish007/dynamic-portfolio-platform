// C:\Users\AB\Desktop\portfolio-website\lib\validation\general.ts

import {
  isNonEmptyString,
  isPlainObject,
  isValidURL,
} from "@/lib/utils/validation";

/* -------------------------------------------------------------------------- */
/*                               COMMON TYPES                                 */
/* -------------------------------------------------------------------------- */

export type IdPayload = {
  id: string;
};

export type SlugPayload = {
  slug: string;
};

export type PaginationPayload = {
  page?: number;
  limit?: number;
};

export type SortPayload = {
  sortBy?: string;
  order?: "asc" | "desc";
};

export type StatusPayload = {
  status?: "draft" | "published" | "archived";
};

/* -------------------------------------------------------------------------- */
/*                               RESULT TYPES                                  */
/* -------------------------------------------------------------------------- */

export type ValidationErrors<T extends string> = Partial<Record<T, string>>;

export type ValidationResult<TData, TKeys extends string> =
  | { ok: true; data: TData }
  | { ok: false; errors: ValidationErrors<TKeys> };

/* -------------------------------------------------------------------------- */
/*                               HELPERS                                      */
/* -------------------------------------------------------------------------- */

function safeString(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return value;
}

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  const n = Math.floor(value);

  if (n < min) {
    return min;
  }

  if (n > max) {
    return max;
  }

  return n;
}

/* -------------------------------------------------------------------------- */
/*                             ID VALIDATION                                  */
/* -------------------------------------------------------------------------- */

export function validateIdPayload(
  input: unknown
): ValidationResult<IdPayload, "id"> {
  if (!isPlainObject(input)) {
    return {
      ok: false,
      errors: { id: "Invalid payload." },
    };
  }

  const id = safeString((input as Partial<IdPayload>).id).trim();

  if (!isNonEmptyString(id)) {
    return {
      ok: false,
      errors: { id: "id is required." },
    };
  }

  return {
    ok: true,
    data: { id },
  };
}

/* -------------------------------------------------------------------------- */
/*                            SLUG VALIDATION                                 */
/* -------------------------------------------------------------------------- */

export function validateSlugPayload(
  input: unknown
): ValidationResult<SlugPayload, "slug"> {
  if (!isPlainObject(input)) {
    return {
      ok: false,
      errors: { slug: "Invalid payload." },
    };
  }

  const slug = safeString((input as Partial<SlugPayload>).slug).trim();

  if (!isNonEmptyString(slug)) {
    return {
      ok: false,
      errors: { slug: "slug is required." },
    };
  }

  return {
    ok: true,
    data: { slug },
  };
}

/* -------------------------------------------------------------------------- */
/*                         PAGINATION VALIDATION                               */
/* -------------------------------------------------------------------------- */

export function validatePaginationPayload(
  input: unknown,
  options?: {
    defaultPage?: number;
    defaultLimit?: number;
    maxLimit?: number;
  }
): ValidationResult<Required<PaginationPayload>, "page" | "limit"> {
  const defaults = {
    defaultPage: 1,
    defaultLimit: 10,
    maxLimit: 100,
    ...(options ?? {}),
  };

  if (!isPlainObject(input)) {
    return {
      ok: true,
      data: {
        page: defaults.defaultPage,
        limit: defaults.defaultLimit,
      },
    };
  }

  const maybe = input as PaginationPayload;

  const pageRaw = maybe.page;
  const limitRaw = maybe.limit;

  const page =
    typeof pageRaw === "number"
      ? clampInt(pageRaw, 1, Number.MAX_SAFE_INTEGER)
      : defaults.defaultPage;

  const limit =
    typeof limitRaw === "number"
      ? clampInt(limitRaw, 1, defaults.maxLimit)
      : defaults.defaultLimit;

  return {
    ok: true,
    data: { page, limit },
  };
}

/* -------------------------------------------------------------------------- */
/*                            SORT VALIDATION                                 */
/* -------------------------------------------------------------------------- */

export function validateSortPayload(
  input: unknown,
  allowedFields: readonly string[]
): ValidationResult<Required<SortPayload>, "sortBy" | "order"> {
  const defaults = {
    sortBy: allowedFields[0] ?? "createdAt",
    order: "desc" as const,
  };

  if (!isPlainObject(input)) {
    return {
      ok: true,
      data: defaults,
    };
  }

  const maybe = input as SortPayload;

  const sortByRaw = safeString(maybe.sortBy);
  const orderRaw = maybe.order;

  const sortBy = allowedFields.includes(sortByRaw)
    ? sortByRaw
    : defaults.sortBy;

  const order = orderRaw === "asc" || orderRaw === "desc"
    ? orderRaw
    : defaults.order;

  return {
    ok: true,
    data: { sortBy, order },
  };
}

/* -------------------------------------------------------------------------- */
/*                          STATUS VALIDATION                                 */
/* -------------------------------------------------------------------------- */

export function validateStatusPayload(
  input: unknown
): ValidationResult<StatusPayload, "status"> {
  if (!isPlainObject(input)) {
    return {
      ok: true,
      data: {},
    };
  }

  const statusRaw = (input as Partial<StatusPayload>).status;

  if (
    statusRaw !== undefined &&
    statusRaw !== "draft" &&
    statusRaw !== "published" &&
    statusRaw !== "archived"
  ) {
    return {
      ok: false,
      errors: {
        status: "Invalid status value.",
      },
    };
  }

  return {
    ok: true,
    data: { status: statusRaw },
  };
}

/* -------------------------------------------------------------------------- */
/*                         GENERIC URL VALIDATION                              */
/* -------------------------------------------------------------------------- */

export function validateOptionalUrl(
  value: unknown,
  fieldName = "url"
): ValidationResult<string | null, typeof fieldName> {
  if (value === undefined || value === null || value === "") {
    return {
      ok: true,
      data: null,
    };
  }

  if (typeof value !== "string") {
    return {
      ok: false,
      errors: {
        [fieldName]: "Invalid URL value.",
      } as Record<typeof fieldName, string>,
    };
  }

  const trimmed = value.trim();

  if (!isValidURL(trimmed)) {
    return {
      ok: false,
      errors: {
        [fieldName]: "URL must be valid (include https://).",
      } as Record<typeof fieldName, string>,
    };
  }

  return {
    ok: true,
    data: trimmed,
  };
}
