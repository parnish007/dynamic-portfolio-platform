// ============================================
// Types
// ============================================

export type DateInput =
  | string
  | number
  | Date
  | null
  | undefined;

export type FormatDateOptions = {
  locale?: string;
  format?: Intl.DateTimeFormatOptions;
  fallback?: string;
};


// ============================================
// Helpers
// ============================================

const toDate = (
  value: DateInput
) => {

  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return null;

  return date;
};


// ============================================
// Format Date (Generic)
// ============================================

export const formatDate = (
  value: DateInput,
  options?: FormatDateOptions
) => {

  const date = toDate(value);

  if (!date) {
    return options?.fallback ?? "";
  }

  const locale = options?.locale ?? "en-US";

  const format: Intl.DateTimeFormatOptions =
    options?.format ?? {
      year: "numeric",
      month: "short",
      day: "2-digit",
    };

  return new Intl.DateTimeFormat(locale, format).format(date);
};


// ============================================
// Presets (Common Use-cases)
// ============================================

export const formatDateShort = (
  value: DateInput,
  locale?: string
) => {

  return formatDate(value, {
    locale,
    format: {
      year: "numeric",
      month: "short",
      day: "numeric",
    },
  });
};

export const formatDateLong = (
  value: DateInput,
  locale?: string
) => {

  return formatDate(value, {
    locale,
    format: {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "long",
    },
  });
};

export const formatDateTime = (
  value: DateInput,
  locale?: string
) => {

  return formatDate(value, {
    locale,
    format: {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    },
  });
};


// ============================================
// Relative Time (Optional Helper)
// ============================================

export const formatRelativeTime = (
  value: DateInput,
  locale = "en"
) => {

  const date = toDate(value);

  if (!date) return "";

  const diffMs = date.getTime() - Date.now();

  const rtf = new Intl.RelativeTimeFormat(locale, {
    numeric: "auto",
  });

  const seconds = Math.round(diffMs / 1000);
  const minutes = Math.round(seconds / 60);
  const hours = Math.round(minutes / 60);
  const days = Math.round(hours / 24);
  const weeks = Math.round(days / 7);

  if (Math.abs(seconds) < 60) return rtf.format(seconds, "second");
  if (Math.abs(minutes) < 60) return rtf.format(minutes, "minute");
  if (Math.abs(hours) < 24) return rtf.format(hours, "hour");
  if (Math.abs(days) < 7) return rtf.format(days, "day");

  return rtf.format(weeks, "week");
};
