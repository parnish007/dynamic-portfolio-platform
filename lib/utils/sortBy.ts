// ============================================
// Types
// ============================================

export type SortDirection =
  | "asc"
  | "desc";

export type SortKey<T> =
  | keyof T
  | ((item: T) => string | number | boolean | Date | null | undefined);

export type SortRule<T> = {
  by: SortKey<T>;
  direction?: SortDirection;
  nulls?: "first" | "last";
};


// ============================================
// Helpers
// ============================================

const valueFromKey = <T>(
  item: T,
  key: SortKey<T>
) => {

  if (typeof key === "function") {
    return key(item);
  }

  return (item as any)[key];
};

const toComparable = (
  value: any
) => {

  if (value instanceof Date) return value.getTime();

  if (typeof value === "boolean") return value ? 1 : 0;

  return value;
};

const compareValues = (
  a: any,
  b: any,
  direction: SortDirection,
  nulls: "first" | "last"
) => {

  const aNull = a === null || a === undefined;
  const bNull = b === null || b === undefined;

  if (aNull && bNull) return 0;

  if (aNull) return nulls === "first" ? -1 : 1;

  if (bNull) return nulls === "first" ? 1 : -1;

  const A = toComparable(a);
  const B = toComparable(b);

  if (A < B) return direction === "asc" ? -1 : 1;

  if (A > B) return direction === "asc" ? 1 : -1;

  return 0;
};


// ============================================
// Sort By One Rule
// ============================================

export const sortBy = <T>(
  items: T[],
  by: SortKey<T>,
  direction: SortDirection = "asc",
  nulls: "first" | "last" = "last"
) => {

  if (!Array.isArray(items)) return [];

  // Comment
  // Stable sort: attach original index as tie-breaker.

  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {

      const av = valueFromKey(a.item, by);
      const bv = valueFromKey(b.item, by);

      const cmp = compareValues(av, bv, direction, nulls);

      if (cmp !== 0) return cmp;

      return a.index - b.index;
    })
    .map((x) => x.item);
};


// ============================================
// Sort By Many Rules (Tie-breakers)
// ============================================

export const sortByMany = <T>(
  items: T[],
  rules: Array<SortRule<T>>
) => {

  if (!Array.isArray(items)) return [];

  if (!Array.isArray(rules) || rules.length === 0) {
    return [...items];
  }

  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {

      for (const rule of rules) {

        const direction = rule.direction ?? "asc";

        const nulls = rule.nulls ?? "last";

        const av = valueFromKey(a.item, rule.by);

        const bv = valueFromKey(b.item, rule.by);

        const cmp = compareValues(av, bv, direction, nulls);

        if (cmp !== 0) return cmp;
      }

      return a.index - b.index;
    })
    .map((x) => x.item);
};
