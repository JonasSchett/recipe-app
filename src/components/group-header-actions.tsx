"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogOut, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deleteGroup, leaveGroup, renameGroup } from "@/lib/actions/groups";
import { useAction } from "@/lib/use-action";

/** Rename/delete for the owner, Leave for a member. */
export function GroupHeaderActions({
  groupId,
  name,
  isOwner,
}: {
  groupId: string;
  name: string;
  isOwner: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const { pending, error, setError, run } = useAction();

  // delete/leave navigate to /groups, which the actions already revalidate.
  if (!isOwner) {
    return (
      <div className="flex flex-col items-end gap-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => {
            if (
              !confirm(
                "Leave this group? Recipes and notes you shared with it stop being shared.",
              )
            )
              return;
            run(() => leaveGroup(groupId), {
              failure: "Could not leave.",
              onSuccess: () => router.push("/groups"),
              refresh: false,
            });
          }}
        >
          <LogOut className="h-4 w-4" /> Leave group
        </Button>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    );
  }

  if (editing) {
    return (
      <div className="flex flex-col items-end gap-1">
        <div className="flex gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            aria-label="Group name"
            maxLength={80}
            autoFocus
          />
          <Button
            type="button"
            size="sm"
            disabled={pending || !draft.trim()}
            onClick={() =>
              run(() => renameGroup(groupId, draft.trim()), {
                failure: "Could not rename.",
                onSuccess: () => setEditing(false),
              })
            }
          >
            Save
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => {
              setDraft(name);
              setEditing(false);
              setError(null);
            }}
          >
            Cancel
          </Button>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setEditing(true)}
          disabled={pending}
        >
          <Pencil className="h-4 w-4" /> Rename
        </Button>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          disabled={pending}
          onClick={() => {
            if (
              !confirm(
                `Delete "${name}"? Everything shared with it stops being shared. This cannot be undone.`,
              )
            )
              return;
            run(() => deleteGroup(groupId), {
              failure: "Could not delete.",
              onSuccess: () => router.push("/groups"),
              refresh: false,
            });
          }}
        >
          <Trash2 className="h-4 w-4" /> Delete group
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
