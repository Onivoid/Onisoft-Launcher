/** Relative luminance (sRGB), WCAG 2.x. */
function relativeLuminance(r: number, g: number, b: number): number {
  const lin = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lin[0]! + 0.7152 * lin[1]! + 0.0722 * lin[2]!;
}

/** Parse #RGB / #RRGGBB / rgb() / rgba() → [r,g,b] 0–255, or null. */
function parseCssColor(input: string): [number, number, number] | null {
  const raw = input.trim();
  if (!raw) return null;

  const hex = raw.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    let h = hex[1]!;
    if (h.length === 3) {
      h = h
        .split("")
        .map((c) => c + c)
        .join("");
    }
    return [
      parseInt(h.slice(0, 2), 16),
      parseInt(h.slice(2, 4), 16),
      parseInt(h.slice(4, 6), 16),
    ];
  }

  const rgb = raw.match(
    /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i
  );
  if (rgb) {
    return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  }

  return null;
}

/**
 * Foreground that contrasts with `background` (black on light, white on dark).
 * Threshold ~0.55 luminance — tuned for brand CTAs (#FAFAFA → dark text).
 */
export function contrastForeground(
  background: string,
  light = "#fafafa",
  dark = "#14141c"
): string {
  const rgb = parseCssColor(background);
  if (!rgb) return light;
  return relativeLuminance(...rgb) > 0.55 ? dark : light;
}
