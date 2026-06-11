export const PALETTE = [
  '#FDE8E8', '#FEF3C7', '#D1FAE5', '#DBEAFE', '#EDE9FE',
  '#FCE7F3', '#ECFDF5', '#FFF7ED', '#F0FDF4', '#E0F2FE',
  '#F5F3FF', '#FFF1F2', '#ECFEFF', '#FEFCE8', '#F7FEE7',
  '#FDF4FF', '#F0F9FF', '#E6FFFA', '#EEF2FF', '#FFF9F0',
]

export function getNextColor(clients: Array<{ color: string }>): string {
  const usedColors = new Set(clients.map((c) => c.color))
  const unused = PALETTE.find((c) => !usedColors.has(c))
  return unused ?? PALETTE[clients.length % PALETTE.length]
}
