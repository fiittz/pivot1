// ──────────────────────────────────────────────────────────────
// Centralized date + currency math
// All date and money calculations go through this module.
// ──────────────────────────────────────────────────────────────

// ── Date helpers ─────────────────────────────────────────────

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

/** Return 0 = Sunday … 6 = Saturday for a Date or ISO string. Always computed. */
export function dayOfWeek(date: Date | string): number {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.getDay();
}

/** Return full English day name ("Monday", etc.) for a Date or ISO string. Always computed. */
export function dayName(date: Date | string): string {
  return DAY_NAMES[dayOfWeek(date)];
}

/** Difference in whole days (b − a), rounded up for partial days. */
export function diffDays(a: Date, b: Date): number {
  const ms = b.getTime() - a.getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

/** Convert ISO date string to DD/MM/YYYY for Revenue submissions. */
export function fmtRevDate(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

/** Format a Date as a human-readable Irish date (e.g. "5 Mar 2026"). */
export function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-IE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Format a tax year heading (e.g. "Year ended 31 December 2025"). */
export function fmtTaxYear(y: string | number): string {
  const year = typeof y === "string" ? parseInt(y, 10) : y;
  return `Year ended 31 December ${year}`;
}

// ── Currency helpers ─────────────────────────────────────────

/** Round to the nearest cent. */
export function roundCent(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Round to whole euro (Revenue uses integers for most monetary fields). */
export function wholeEuro(n: number): number {
  return Math.round(n);
}

/** Format to cent precision string (RCT uses cent precision). */
export function centEuro(n: number): string {
  return n.toFixed(2);
}

const euroFormatter = new Intl.NumberFormat("en-IE", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
});

/** Format a number as Irish euro (e.g. "€1,234.56"). */
export function fmtEuro(n: number): string {
  return euroFormatter.format(n);
}

/** Format a decimal as a percentage string (e.g. 0.2 → "20%"). */
export function fmtPercent(n: number): string {
  return `${(n * 100).toFixed(0)}%`;
}
