export const getNextSortOrder = (items) =>
  items.length > 0 ? Math.max(...items.map((i) => i.sort_order ?? 0)) + 1 : 0;
