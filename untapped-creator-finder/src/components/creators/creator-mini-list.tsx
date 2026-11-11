import Link from "next/link";
import { Avatar, Badge } from "@/components/ui";
import { ScorePill } from "@/components/score";
import { PlatformChips } from "./platform-icons";
import { fmtCount, fmtRelative } from "@/lib/format";
import type { CreatorRow } from "@/server/creators";

export function CreatorMiniList({ rows, show }: { rows: CreatorRow[]; show: "discovered" | "opportunity" }) {
  return (
    <ul className="divide-y divide-line">
      {rows.map((c) => (
        <li key={c.id}>
          <Link href={`/creators/${c.id}`} className="flex items-center gap-3 px-5 py-3 transition hover:bg-surface-2">
            <Avatar name={c.displayName} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-[13px] font-medium">{c.displayName}</span>
                {c.isDemo && <Badge tone="muted">Demo</Badge>}
              </div>
              <div className="flex items-center gap-2 text-[12px] text-muted">
                <span className="truncate">{c.primaryNiche ?? "Unclassified"}</span>
                <span>·</span>
                <span className="tabular">{fmtCount(c.totalFollowers)}</span>
                <PlatformChips platforms={c.platforms} />
              </div>
            </div>
            <div className="shrink-0 text-right text-[12px] text-muted">
              {show === "opportunity" ? (
                <ScorePill kind="opportunity" value={c.opportunityScore} confidence={c.scoreConfidence} />
              ) : (
                fmtRelative(c.discoveredAt)
              )}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
