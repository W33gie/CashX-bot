import { cn } from "@/lib/utils";

/**
 * Scores are only shown as numbers when they exist. A null score renders as
 * "Not scored" — never as 0 — so missing data can't masquerade as a signal.
 */
export function ScorePill({
  value,
  kind,
  confidence,
  className,
}: {
  value: number | null | undefined;
  kind: "opportunity" | "saturation";
  confidence?: number | null;
  className?: string;
}) {
  if (value == null) {
    return <span className={cn("text-[12px] text-muted", className)}>Not scored</span>;
  }
  // Opportunity: high is good (green). Saturation: high is crowded (warm).
  const t = value / 100;
  const color =
    kind === "opportunity"
      ? t >= 0.7 ? "var(--good)" : t >= 0.4 ? "var(--accent)" : "var(--muted)"
      : t >= 0.7 ? "var(--bad)" : t >= 0.4 ? "var(--warn)" : "var(--good)";
  const lowConf = confidence != null && confidence < 0.5;
  return (
    <span className={cn("inline-flex items-center gap-2", className)} title={confidence != null ? `Confidence ${(confidence * 100).toFixed(0)}%` : undefined}>
      <span className="relative h-1.5 w-12 overflow-hidden rounded-full bg-surface-2">
        <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${value}%`, background: color }} />
      </span>
      <span className={cn("tabular text-[12.5px] font-semibold", lowConf && "opacity-60")}>{value}</span>
      {lowConf && <span className="text-[11px] text-muted">low conf.</span>}
    </span>
  );
}

export function ConfidenceMeter({ value }: { value: number | null | undefined }) {
  if (value == null) return <span className="text-[12px] text-muted">—</span>;
  const bars = Math.round(value * 5);
  return (
    <span className="inline-flex items-center gap-1.5" title={`${Math.round(value * 100)}% confidence`}>
      <span className="flex gap-0.5">
        {Array.from({ length: 5 }, (_, i) => (
          <span key={i} className={cn("h-2.5 w-1 rounded-sm", i < bars ? "bg-accent" : "bg-line-strong")} />
        ))}
      </span>
      <span className="tabular text-[12px] text-muted">{Math.round(value * 100)}%</span>
    </span>
  );
}
