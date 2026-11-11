"use client";

import { useActionState } from "react";
import { createCreator, type ActionState } from "@/app/(app)/actions";
import { Button, Input, Label, Select, Textarea, Card } from "@/components/ui";
import { COUNTRIES, LANGUAGES, NICHES, PLATFORMS } from "@/lib/constants";

export function NewCreatorForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(createCreator, undefined);
  const e = state?.fieldErrors ?? {};
  return (
    <form action={action} className="grid gap-5 lg:grid-cols-[1fr_1fr]">
      <Card className="p-5">
        <h2 className="mb-4 text-[13px] font-semibold">Creator</h2>
        <div className="space-y-4">
          <div>
            <Label htmlFor="displayName" error={e.displayName}>Display name</Label>
            <Input id="displayName" name="displayName" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="primaryNiche">Niche</Label>
              <Input id="primaryNiche" name="primaryNiche" list="niche-options" placeholder="e.g. Fitness" />
              <datalist id="niche-options">{NICHES.map((n) => <option key={n} value={n} />)}</datalist>
            </div>
            <div>
              <Label htmlFor="country">Country</Label>
              <Select id="country" name="country" defaultValue="">
                <option value="">Unknown</option>
                {COUNTRIES.map(([c, n]) => <option key={c} value={c}>{n}</option>)}
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="language">Content language</Label>
              <Select id="language" name="language" defaultValue="">
                <option value="">Unknown</option>
                {LANGUAGES.map(([c, n]) => <option key={c} value={c}>{n}</option>)}
              </Select>
            </div>
            <div>
              <Label htmlFor="websiteUrl" error={e.websiteUrl}>Website</Label>
              <Input id="websiteUrl" name="websiteUrl" type="url" placeholder="https://" />
            </div>
          </div>
          <div>
            <Label htmlFor="bio" hint="Paste their public bio">Bio</Label>
            <Textarea id="bio" name="bio" rows={4} />
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="mb-1 text-[13px] font-semibold">Primary platform account</h2>
        <p className="mb-4 text-[12.5px] text-muted">Leave metrics blank if you don&apos;t know them — blanks are stored as unknown, not zero.</p>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="platform">Platform</Label>
              <Select id="platform" name="platform" defaultValue="YOUTUBE">
                {PLATFORMS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </Select>
            </div>
            <div>
              <Label htmlFor="handle" error={e.handle}>Handle</Label>
              <Input id="handle" name="handle" required placeholder="@handle" />
            </div>
          </div>
          <div>
            <Label htmlFor="url" error={e.url} hint="Optional — built from handle">Profile URL</Label>
            <Input id="url" name="url" type="url" placeholder="https://" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="followers" error={e.followers}>Followers</Label>
              <Input id="followers" name="followers" inputMode="numeric" />
            </div>
            <div>
              <Label htmlFor="avgViews" error={e.avgViews}>Avg views</Label>
              <Input id="avgViews" name="avgViews" inputMode="numeric" />
            </div>
            <div>
              <Label htmlFor="engagementRate" error={e.engagementRate}>Engagement %</Label>
              <Input id="engagementRate" name="engagementRate" inputMode="decimal" placeholder="e.g. 4.2" />
            </div>
          </div>
        </div>
        {state?.error && <p className="mt-4 rounded-lg bg-bad-soft px-3 py-2 text-[12.5px] text-bad">{state.error}</p>}
        <div className="mt-6 flex justify-end">
          <Button variant="primary" disabled={pending}>{pending ? "Saving…" : "Add creator"}</Button>
        </div>
      </Card>
    </form>
  );
}
