import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { NewCreatorForm } from "@/components/creators/new-creator-form";

export const metadata = { title: "Add creator" };

export default function NewCreatorPage() {
  return (
    <>
      <PageHeader
        eyebrow={<Link href="/creators" className="hover:text-ink">← Creators</Link>}
        title="Add a creator"
        description="Record a creator you found yourself. Entries are tagged “Entered manually” so they’re always distinguishable from provider data."
      />
      <NewCreatorForm />
    </>
  );
}
