"use client";

import Link from "next/link";
import { useState } from "react";
import { Globe, TriangleAlert, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setAllExistingSharing } from "@/lib/actions/sharing";
import { useAction } from "@/lib/use-action";

type Kind = "recipes" | "notes";
type Counts = { recipes: number; notes: number };
type GroupCounts = { id: string; name: string } & Counts & {
  sharedRecipes: number;
  sharedNotes: number;
};

function plural(n: number, kind: Kind) {
  const word = kind === "recipes" ? "recipe" : "note";
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/**
 * One audience (everyone, or a group). "Share" buttons for both kinds; a
 * group also gets "Stop sharing" buttons. Everyone doesn't: making every item
 * private would also revert ones made public on purpose.
 */
function AudienceRow({
  icon: Icon,
  label,
  groupId,
  toShare,
  shared,
}: {
  icon: typeof Globe;
  label: string;
  groupId: string | null;
  /** Items not yet shared with this audience. */
  toShare: Counts;
  /** Items already shared with it — groups only. */
  shared?: Counts;
}) {
  const [notice, setNotice] = useState<string | null>(null);
  const { pending, error, run } = useAction();
  const audience = groupId ? label : "everyone";

  function apply(kind: Kind, share: boolean) {
    const what = plural(share ? toShare[kind] : shared![kind], kind);
    const question = !share
      ? `Stop sharing all ${what} of yours with ${audience}? Members will no longer see them.`
      : groupId
        ? `Share all ${what} of yours not yet shared with ${audience}? To undo, use “Stop sharing” or change them individually.`
        : `Share all ${what} of yours with everyone? There's no bulk undo — you'd have to change them back one by one.`;
    if (!confirm(question)) return;
    setNotice(null);
    run(() => setAllExistingSharing({ kind, groupId, share }), {
      failure: share ? "Could not share." : "Could not stop sharing.",
      onSuccess: ({ changed }) =>
        setNotice(
          share
            ? `Shared ${plural(changed, kind)}.`
            : `Stopped sharing ${plural(changed, kind)}.`,
        ),
    });
  }

  return (
    <li className="flex flex-col gap-2 rounded-md border border-amber-500/30 bg-background/60 p-3">
      <span className="flex items-center gap-1.5 text-sm font-medium">
        <Icon className="h-4 w-4 text-muted-foreground" /> {label}
      </span>
      <div className="flex flex-wrap gap-2">
        {(["recipes", "notes"] as const).map((kind) => (
          <Button
            key={kind}
            type="button"
            variant="outline"
            size="sm"
            disabled={pending || toShare[kind] === 0}
            onClick={() => apply(kind, true)}
          >
            {toShare[kind] === 0
              ? `No ${kind} left to share`
              : `Share ${plural(toShare[kind], kind)}`}
          </Button>
        ))}
        {shared &&
          (["recipes", "notes"] as const)
            .filter((kind) => shared[kind] > 0)
            .map((kind) => (
              <Button
                key={`stop-${kind}`}
                type="button"
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() => apply(kind, false)}
              >
                Stop sharing {plural(shared[kind], kind)}
              </Button>
            ))}
      </div>
      {notice && <p className="text-sm text-muted-foreground">{notice}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </li>
  );
}

/**
 * Bulk catch-up for items saved before a default was switched on. Deliberately
 * buttons, not toggles: it's a one-off action on saved data.
 */
export function ShareExistingPanel({
  everyone,
  groups,
}: {
  everyone: Counts;
  groups: GroupCounts[];
}) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
      <div className="flex flex-col gap-1">
        <h2 className="flex items-center gap-2 font-semibold">
          <TriangleAlert className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          Share existing items
        </h2>
        <p className="text-sm">
          These buttons change <strong>all</strong>{" "}
          of your existing recipes or notes at once — not just new ones. To
          share only some of them, select recipes on the{" "}
          <Link href="/recipes" className="underline underline-offset-2">
            recipe list
          </Link>{" "}
          and use “Share”, or change sharing on each recipe or note
          individually.
        </p>
        <p className="text-xs text-muted-foreground">
          Only your own recipes and notes are affected. Sharing with everyone
          has no bulk undo; a group can be undone with “Stop sharing”.
        </p>
      </div>

      <ul className="flex flex-col gap-2">
        <AudienceRow icon={Globe} label="Everyone" groupId={null} toShare={everyone} />
        {groups.map((group) => (
          <AudienceRow
            key={group.id}
            icon={Users}
            label={group.name}
            groupId={group.id}
            toShare={group}
            shared={{ recipes: group.sharedRecipes, notes: group.sharedNotes }}
          />
        ))}
      </ul>
    </section>
  );
}
