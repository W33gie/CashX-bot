const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

/** 12_400 -> "12.4K". null/undefined -> "—" (unknown, never 0). */
export function fmtCount(n: number | null | undefined): string {
  return n == null ? "—" : compact.format(n);
}

/** 0.0432 -> "4.3%". */
export function fmtPct(n: number | null | undefined, digits = 1): string {
  return n == null ? "—" : `${(n * 100).toFixed(digits)}%`;
}

/** Signed growth: 0.12 -> "+12.0%". */
export function fmtGrowth(n: number | null | undefined): string {
  if (n == null) return "—";
  const s = (n * 100).toFixed(1);
  return n > 0 ? `+${s}%` : `${s}%`;
}

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
export function fmtRelative(d: Date | null | undefined, now = new Date()): string {
  if (!d) return "—";
  const sec = Math.round((d.getTime() - now.getTime()) / 1000);
  const abs = Math.abs(sec);
  if (abs < 60) return rtf.format(sec, "second");
  if (abs < 3600) return rtf.format(Math.round(sec / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(sec / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(sec / 86400), "day");
  if (abs < 86400 * 365) return rtf.format(Math.round(sec / (86400 * 30)), "month");
  return rtf.format(Math.round(sec / (86400 * 365)), "year");
}

export function fmtDate(d: Date | null | undefined): string {
  return d ? d.toLocaleDateString("en", { year: "numeric", month: "short", day: "numeric" }) : "—";
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}
