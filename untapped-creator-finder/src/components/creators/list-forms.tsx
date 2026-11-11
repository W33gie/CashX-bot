"use client";

import { useActionState, useEffect, useRef } from "react";
import { createList, type ActionState } from "@/app/(app)/actions";
import { Button, Input, Label } from "@/components/ui";

export function CreateListForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(createList, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={action} className="grid gap-3 sm:grid-cols-[1fr_1.5fr_auto] sm:items-end">
      <div>
        <Label htmlFor="list-name" error={state?.fieldErrors?.name}>List name</Label>
        <Input id="list-name" name="name" placeholder="e.g. Q1 fitness shortlist" />
      </div>
      <div>
        <Label htmlFor="list-desc">Description</Label>
        <Input id="list-desc" name="description" placeholder="Optional" />
      </div>
      <Button variant="primary" disabled={pending}>Create list</Button>
    </form>
  );
}
