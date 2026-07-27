export function formatBytes(bytes: number, locale = "fr"): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  const units =
    locale.startsWith("fr")
      ? (["o", "Ko", "Mo", "Go", "To"] as const)
      : (["B", "KB", "MB", "GB", "TB"] as const);
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const digits = unit === 0 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(digits)} ${units[unit]}`;
}
