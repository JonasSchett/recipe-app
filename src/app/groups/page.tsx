import Link from "next/link";
import { BookOpen, Crown, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CreateGroupForm } from "@/components/create-group-form";
import { requirePageUser } from "@/lib/auth-guards";
import { getMyGroups } from "@/lib/queries";

export default async function GroupsPage() {
  await requirePageUser();
  const groups = await getMyGroups();

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Family Groups</h1>
        <p className="text-sm text-muted-foreground">
          Share recipes and notes with just the people you cook with, without
          making them public. Joining a group shares nothing of yours until you
          choose to — set per-group defaults on your{" "}
          <Link href="/account" className="underline underline-offset-2">
            account page
          </Link>
          .
        </p>
      </div>

      <CreateGroupForm />

      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          You&apos;re not in any groups yet. Create one above, or ask someone
          for an invite link.
        </p>
      ) : (
        <ul className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(18rem,1fr))]">
          {groups.map((group) => (
            <li key={group.id}>
              <Link
                href={`/groups/${group.id}`}
                className="flex h-full flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm transition-colors hover:bg-accent/40"
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-semibold leading-tight">{group.name}</h2>
                  {group.isOwner && (
                    <Badge variant="secondary" className="gap-1">
                      <Crown className="h-3 w-3" /> Owner
                    </Badge>
                  )}
                </div>
                <p className="mt-auto flex flex-wrap items-center gap-x-3 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" />
                    {group._count.members} member
                    {group._count.members === 1 ? "" : "s"}
                  </span>
                  <span className="flex items-center gap-1">
                    <BookOpen className="h-3.5 w-3.5" />
                    {group._count.recipeShares} recipe
                    {group._count.recipeShares === 1 ? "" : "s"}
                  </span>
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
