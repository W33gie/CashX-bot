import type { Platform } from "@/generated/prisma/enums";
import { PLATFORM_LABEL } from "@/lib/constants";

const glyph: Record<Platform, string> = { YOUTUBE: "YT", INSTAGRAM: "IG", TIKTOK: "TT" };

export function PlatformChips({ platforms }: { platforms: Platform[] }) {
  if (!platforms.length) return <span className="text-muted">—</span>;
  return (
    <span className="inline-flex gap-1">
      {platforms.map((p) => (
        <span
          key={p}
          title={PLATFORM_LABEL[p]}
          className="rounded border border-line bg-surface-2 px-1 py-px font-mono text-[10px] font-semibold text-ink-2"
        >
          {glyph[p]}
        </span>
      ))}
    </span>
  );
}
