import Link from "next/link";
import { SlidersHorizontal } from "lucide-react";
import { Input, Select, Button } from "@/components/ui";
import { COUNTRIES, LANGUAGES, PLATFORMS, PROSPECT_STATUSES, SIZE_TIERS } from "@/lib/constants";
import type { CreatorFilters } from "@/server/filters";

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11.5px] font-medium text-muted">{label}</span>
      {children}
    </label>
  );
}

/** Plain GET form: filters live in the URL, so every view is shareable and bookmarkable. */
export function FilterBar({
  f,
  niches,
  lists,
  advancedOpen,
}: {
  f: CreatorFilters;
  niches: string[];
  lists: { id: string; name: string }[];
  advancedOpen: boolean;
}) {
  return (
    <form method="get" className="rounded-xl border border-line bg-surface p-3">
      {f.sort && <input type="hidden" name="sort" value={f.sort} />}
      {f.dir && <input type="hidden" name="dir" value={f.dir} />}
      <div className="flex flex-col gap-2 md:flex-row">
        <Input name="q" defaultValue={f.q} placeholder="Search name, handle, niche or bio…" className="md:flex-1" />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:flex">
          <Select name="niche" defaultValue={f.niche ?? ""} aria-label="Niche" className="md:w-40">
            <option value="">All niches</option>
            {niches.map((n) => <option key={n}>{n}</option>)}
          </Select>
          <Select name="platform" defaultValue={f.platform ?? ""} aria-label="Platform" className="md:w-36">
            <option value="">All platforms</option>
            {PLATFORMS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </Select>
          <Select name="size" defaultValue={f.size ?? ""} aria-label="Creator size" className="md:w-44">
            <option value="">Any size</option>
            {SIZE_TIERS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </Select>
          <Button variant="primary" className="md:w-auto">Apply</Button>
        </div>
      </div>

      <details open={advancedOpen} className="group mt-2">
        <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-md px-1 py-1 text-[12.5px] font-medium text-ink-2 hover:text-ink">
          <SlidersHorizontal className="size-3.5" /> More filters
        </summary>
        <div className="mt-2 grid grid-cols-2 gap-3 border-t border-line pt-3 sm:grid-cols-3 lg:grid-cols-6">
          <F label="Country">
            <Select name="country" defaultValue={f.country ?? ""}>
              <option value="">Any</option>
              {COUNTRIES.map(([c, n]) => <option key={c} value={c}>{n}</option>)}
            </Select>
          </F>
          <F label="Language">
            <Select name="language" defaultValue={f.language ?? ""}>
              <option value="">Any</option>
              {LANGUAGES.map(([c, n]) => <option key={c} value={c}>{n}</option>)}
            </Select>
          </F>
          <F label="Min followers">
            <Input name="minFollowers" inputMode="numeric" defaultValue={f.minFollowers} placeholder="e.g. 5000" />
          </F>
          <F label="Max followers">
            <Input name="maxFollowers" inputMode="numeric" defaultValue={f.maxFollowers} placeholder="e.g. 100000" />
          </F>
          <F label="Min engagement %">
            <Input name="minEngagement" inputMode="decimal" defaultValue={f.minEngagement} placeholder="e.g. 3" />
          </F>
          <F label="Min 30-day growth %">
            <Input name="minGrowth" inputMode="decimal" defaultValue={f.minGrowth} placeholder="e.g. 5" />
          </F>
          <F label="Commercial activity">
            <Select name="commercial" defaultValue={f.commercial ?? ""}>
              <option value="">Any</option>
              <option value="none_observed">None observed yet</option>
              <option value="some">Some (1–4 signals)</option>
              <option value="heavy">Heavy (5+ signals)</option>
            </Select>
          </F>
          <F label="Max saturation">
            <Input name="maxSaturation" inputMode="numeric" defaultValue={f.maxSaturation} placeholder="0–100" />
          </F>
          <F label="Min opportunity">
            <Input name="minOpportunity" inputMode="numeric" defaultValue={f.minOpportunity} placeholder="0–100" />
          </F>
          <F label="Prospect status">
            <Select name="status" defaultValue={f.status ?? ""}>
              <option value="">Any</option>
              {PROSPECT_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </Select>
          </F>
          <F label="List">
            <Select name="list" defaultValue={f.list ?? ""}>
              <option value="">Any</option>
              {lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </Select>
          </F>
          <F label="Demo data">
            <Select name="demo" defaultValue={f.demo ?? ""}>
              <option value="">Include</option>
              <option value="hide">Hide demo</option>
              <option value="only">Demo only</option>
            </Select>
          </F>
          <label className="col-span-2 flex items-center gap-2 text-[12.5px] text-ink-2 sm:col-span-1">
            <input type="checkbox" name="saved" value="1" defaultChecked={!!f.saved} className="size-4 accent-[var(--accent)]" />
            Saved only
          </label>
          <div className="col-span-2 flex items-end gap-2 sm:col-span-3 lg:col-span-5 lg:justify-end">
            <Link href="/creators" className="text-[12.5px] font-medium text-muted hover:text-ink">Reset all</Link>
            <Button variant="primary" size="sm">Apply filters</Button>
          </div>
        </div>
      </details>
    </form>
  );
}
