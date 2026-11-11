import { Bookmark } from "lucide-react";
import { toggleSaved } from "@/app/(app)/actions";
import { cn } from "@/lib/utils";

export function SaveButton({ creatorId, saved, withLabel }: { creatorId: string; saved: boolean; withLabel?: boolean }) {
  return (
    <form action={toggleSaved}>
      <input type="hidden" name="creatorId" value={creatorId} />
      <button
        title={saved ? "Remove from saved" : "Save prospect"}
        aria-pressed={saved}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg transition",
          withLabel ? "h-9 border border-line bg-surface px-3 text-[13px] font-medium hover:bg-surface-2" : "p-1.5 hover:bg-surface-2",
          saved ? "text-accent" : "text-muted hover:text-ink",
        )}
      >
        <Bookmark className="size-4" fill={saved ? "currentColor" : "none"} />
        {withLabel && (saved ? "Saved" : "Save")}
      </button>
    </form>
  );
}
