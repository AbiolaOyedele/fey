/**
 * Warm, color-matched text colors for the standard app palette.
 * For palette pastels: returns a curated dark shade that matches the hue.
 * For unknown / custom colors: luminance decides white vs near-black.
 */
const PALETTE_TEXT = {
  '#FDE8E8': '#92400E',
  '#FEF3C7': '#78350F',
  '#D1FAE5': '#065F46',
  '#DBEAFE': '#1E3A8A',
  '#EDE9FE': '#5B21B6',
  '#FCE7F3': '#9D174D',
  '#ECFDF5': '#047857',
  '#FFF7ED': '#9A3412',
  '#F0FDF4': '#166534',
  '#E0F2FE': '#0C4A6E',
  '#F5F3FF': '#4C1D95',
  '#FFF1F2': '#9F1239',
  '#ECFEFF': '#164E63',
  '#FEFCE8': '#713F12',
  '#F7FEE7': '#365314',
  '#FDF4FF': '#701A75',
  '#F0F9FF': '#0C4A6E',
  '#E6FFFA': '#134E4A',
  '#EEF2FF': '#312E81',
  '#FFF9F0': '#7C2D12',
};

/**
 * Given a hex color string (e.g. "#4B0082" or "#FDE8E8"),
 * returns a legible foreground color:
 *   • Palette pastels → warm color-matched dark shade (preserves designed look)
 *   • Dark custom colors → white
 *   • Light custom colors → near-black
 */
export function getContrastColor(hex) {
  if (!hex || typeof hex !== 'string') return '#1a1a2e';

  const upper = hex.toUpperCase();

  // Check curated palette first
  if (PALETTE_TEXT[upper]) return PALETTE_TEXT[upper];
  // Also check as-is (in case casing differs)
  if (PALETTE_TEXT[hex]) return PALETTE_TEXT[hex];

  // Fallback: luminance-based (ITU-R BT.601)
  const clean = hex.replace('#', '');
  const full =
    clean.length === 3
      ? clean.split('').map((c) => c + c).join('')
      : clean;

  if (full.length !== 6) return '#1a1a2e';

  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);

  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#1a1a2e' : '#ffffff';
}
