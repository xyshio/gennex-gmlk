import Link from "next/link";
import { Plus } from "lucide-react";
import { readTree } from "@/lib/store";
import { PeopleTable } from "@/components/PeopleTable";

export const dynamic = "force-dynamic";

export default async function PeoplePage() {
  const tree = await readTree();
  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-baseline justify-between gap-4">
        <h1 className="text-xl font-semibold tracking-tight">People</h1>
        <Link
          href="/people/new"
          className="inline-flex items-center gap-1.5 rounded-md bg-ink-accent px-3 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-ink-accent/90"
        >
          <Plus className="h-4 w-4" />
          Add person
        </Link>
      </header>
      <PeopleTable initial={tree.persons} />
    </div>
  );
}
