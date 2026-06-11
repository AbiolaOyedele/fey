export const getNextSortOrder = (items: Array<{ sort_order?: number }>): number =>
  items.length > 0 ? Math.max(...items.map((i) => i.sort_order ?? 0)) + 1 : 0
