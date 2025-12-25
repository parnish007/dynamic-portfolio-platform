// ============================================
// Filter Array by Key Value
// ============================================

export const filterBy = <T, K extends keyof T>(
  items: T[],
  key: K,
  value: T[K]
) => {

  if (!Array.isArray(items)) return [];

  return items.filter((item) => item[key] === value);
};


// ============================================
// Filter Array by Multiple Key Values
// ============================================

export const filterByMany = <T, K extends keyof T>(
  items: T[],
  key: K,
  values: T[K][]
) => {

  if (!Array.isArray(items)) return [];

  if (!Array.isArray(values) || values.length === 0) {
    return [];
  }

  return items.filter((item) => values.includes(item[key]));
};


// ============================================
// Filter with Custom Predicate
// ============================================

export const filterWhere = <T>(
  items: T[],
  predicate: (item: T) => boolean
) => {

  if (!Array.isArray(items)) return [];

  return items.filter(predicate);
};
