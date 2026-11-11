"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  addNote,
  addCommercialSignal,
  updateAccountMetrics,
  addPlatformAccount,
  createList,
  setProspectStatus,
  type ActionState,
} from "@/app/(app)/actions";
import { Button, Input, Label, Select, Textarea } from "@/components/ui";
import { PLATFORMS, PROSPECT_STATUSES, SIGNAL_LABEL } from "@/lib/constants";
import type { ProspectStatus } from "@/generated/prisma/enums";

function useResetOnSuccess(state: ActionState) {
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);
  return ref;
}

export function StatusSelect({ creatorId, status }: { creatorId: string; status: ProspectStatus | null }) {
  return (
    <form action={setProspectStatus}>
      <input type="hidden" name="creatorId" value={creatorId} />
      <Select
        name="status"
        aria-label="Prospect status"
        defaultValue={status ?? "NEW"}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="w-44"
      >
        {PROSPECT_STATUSES.map((s) => (
          <option key={s.value} value={s.value}>{s.label}</option>
        ))}
      </Select>
    </form>
  );
}

export function NoteForm({ creatorId }: { creatorId: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(addNote, undefined);
  const ref = useResetOnSuccess(state);
  return (
    <form ref={ref} action={action} className="space-y-2">
      <input type="hidden" name="creatorId" value={creatorId} />
      <Textarea name="body" rows={3} placeholder="Add a note for your team…" aria-label="Note" />
      <div className="flex items-center justify-between">
        <span className="text-[12px] text-bad">{state?.fieldErrors?.body}</span>
        <Button size="sm" variant="primary" disabled={pending}>{pending ? "Saving…" : "Add note"}</Button>
      </div>
    </form>
  );
}

export function SignalForm({ creatorId }: { creatorId: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(addCommercialSignal, undefined);
  const ref = useResetOnSuccess(state);
  const e = state?.fieldErrors ?? {};
  return (
    <form ref={ref} action={action} className="grid gap-3 sm:grid-cols-[180px_1fr]">
      <input type="hidden" name="creatorId" value={creatorId} />
      <div>
        <Label htmlFor="sig-type">Type</Label>
        <Select id="sig-type" name="type">
          {Object.entries(SIGNAL_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </Select>
      </div>
      <div>
        <Label htmlFor="sig-ev" error={e.evidence}>What you observed</Label>
        <Input id="sig-ev" name="evidence" placeholder='e.g. "Sponsored by Acme" in 12 Oct video description' />
      </div>
      <div className="sm:col-span-2 sm:grid sm:grid-cols-[1fr_auto] sm:items-end sm:gap-3">
        <div>
          <Label htmlFor="sig-url" error={e.sourceUrl}>Source link</Label>
          <Input id="sig-url" name="sourceUrl" type="url" placeholder="https://" />
        </div>
        <Button size="sm" className="mt-3 h-9 sm:mt-0" disabled={pending}>Record evidence</Button>
      </div>
    </form>
  );
}

export function MetricsForm({
  account,
}: {
  account: { id: string; followers: number | null; avgViews: number | null; engagementRate: number | null; postsLast30d: number | null };
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(updateAccountMetrics, undefined);
  const e = state?.fieldErrors ?? {};
  return (
    <form action={action} className="grid grid-cols-2 gap-2 sm:grid-cols-5 sm:items-end">
      <input type="hidden" name="accountId" value={account.id} />
      <div>
        <Label error={e.followers}>Followers</Label>
        <Input name="followers" inputMode="numeric" defaultValue={account.followers ?? ""} />
      </div>
      <div>
        <Label error={e.avgViews}>Avg views</Label>
        <Input name="avgViews" inputMode="numeric" defaultValue={account.avgViews ?? ""} />
      </div>
      <div>
        <Label error={e.engagementRate}>Eng. %</Label>
        <Input
          name="engagementRate"
          inputMode="decimal"
          defaultValue={account.engagementRate != null ? (account.engagementRate * 100).toFixed(2) : ""}
        />
      </div>
      <div>
        <Label error={e.postsLast30d}>Posts / 30d</Label>
        <Input name="postsLast30d" inputMode="numeric" defaultValue={account.postsLast30d ?? ""} />
      </div>
      <Button size="sm" className="h-9" disabled={pending}>{state?.ok ? "Saved ✓" : pending ? "Saving…" : "Save snapshot"}</Button>
      {state?.error && <p className="col-span-full text-[12px] text-bad">{state.error}</p>}
    </form>
  );
}

export function AddAccountForm({ creatorId }: { creatorId: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(addPlatformAccount, undefined);
  const ref = useResetOnSuccess(state);
  return (
    <form ref={ref} action={action} className="grid grid-cols-2 gap-2 sm:grid-cols-[140px_1fr_1fr_auto] sm:items-end">
      <input type="hidden" name="creatorId" value={creatorId} />
      <div>
        <Label>Platform</Label>
        <Select name="platform">{PLATFORMS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</Select>
      </div>
      <div>
        <Label error={state?.fieldErrors?.handle}>Handle</Label>
        <Input name="handle" placeholder="@handle" />
      </div>
      <div className="col-span-2 sm:col-span-1">
        <Label error={state?.fieldErrors?.url}>URL (optional)</Label>
        <Input name="url" type="url" />
      </div>
      <Button size="sm" className="h-9" disabled={pending}>Link account</Button>
      {state?.error && <p className="col-span-full text-[12px] text-bad">{state.error}</p>}
    </form>
  );
}

export function NewListInline({ creatorId }: { creatorId: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(createList, undefined);
  const ref = useResetOnSuccess(state);
  return (
    <form ref={ref} action={action} className="flex gap-2">
      <input type="hidden" name="creatorId" value={creatorId} />
      <Input name="name" placeholder="New list name" aria-label="New list name" className="h-8" />
      <Button size="sm" disabled={pending}>Create</Button>
      {state?.fieldErrors?.name && <span className="self-center text-[12px] text-bad">{state.fieldErrors.name}</span>}
    </form>
  );
}
