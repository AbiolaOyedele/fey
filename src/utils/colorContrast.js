/**
 * Given a hex color string (e.g. "#4B0082" or "#FDE8E8"),
 * returns a legible foreground color: white for dark backgrounds,
 * near-black for light backgrounds.
 */
export function getContrastColor(hex) {
  if (!hex || typeof hex !== 'string') return '#1a1a2e';

  // Strip leading #
  const clean = hex.replace('#', '');

  // Handle 3-char shorthand
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean;

  if (full.length !== 6) return '#1a1a2e';

  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);

  // Perceived luminance (ITU-R BT.601)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  return luminance > 0.5 ? '#1a1a2e' : '#ffffff';
}
