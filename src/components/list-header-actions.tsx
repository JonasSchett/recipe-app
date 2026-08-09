"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogOut, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deleteList, leaveList, renameList } from "@/lib/actions/lists";
import type { ListPermission } from "@/lib/list-access";
import { useAction } from "@/lib/use-action";

/** Rename/delete for an owner, Leave for a member. */
export function ListHeaderActions({
  listId,
  name,
  permission,
}: {
  listId: string;
  name: string;
  permission: ListPermission;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const { pending, error, setError, run } = useAction();

  // Navigating to /lists after delete/leave needs no router.refresh(): the
  // actions call revalidatePath("/lists"), which already drops the client
  // router cache entry. Verified by removing it and watching the index still
  // come back correct. Hence `refresh: false` on those two.

  if (permission !== "OWNER") {
    return (
      <div className="flex flex-col items-end gap-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => {
            if (!confirm("Leave this list? You'll lose access to it.")) return;
            run(() => leaveList(listId), {
              failure: "Could not leave.",
              onSuccess: () => router.push("/lists"),
              refresh: false,
            });
          }}
        >
          <LogOut className="h-4 w-4" /> Leave list
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
            aria-label="List name"
            maxLength={80}
            autoFocus
          />
          <Button
            type="button"
            size="sm"
            disabled={pending || !draft.trim()}
            onClick={() =>
              run(() => renameList(listId, draft.trim()), {
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
            if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
            run(() => deleteList(listId), {
              failure: "Could not delete.",
              onSuccess: () => router.push("/lists"),
              refresh: false,
            });
          }}
        >
          <Trash2 className="h-4 w-4" /> Delete list
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
