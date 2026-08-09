"use client";

import { useState } from "react";
import { Pin, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addRecipesToList, createList } from "@/lib/actions/lists";
import { useAction } from "@/lib/use-action";

export type PinnableList = { id: string; name: string; _count: { items: number } };

/** Remembers the list you pinned to last, so the common case is two taps. */
const LAST_LIST_KEY = "recipe-app:last-pinned-list";

/**
 * Pin a recipe to one of your lists, or a brand new one.
 *
 * The last-used list is remembered in localStorage rather than as a user
 * setting: it's a UI convenience, changes constantly, and isn't worth a column
 * or a write on every pin.
 */
export function PinToList({
  recipeId,
  lists,
}: {
  recipeId: string;
  lists: PinnableList[];
}) {
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [lastListId, setLastListId] = useState<string | null>(null);
  const { pending, error, run } = useAction();

  /**
   * Read the remembered list when the picker opens rather than in an effect:
   * localStorage doesn't exist during the server render, so reading it on
   * mount would either mismatch hydration or need an extra render pass. By
   * the time the user clicks, we're unambiguously on the client.
   */
  function toggleOpen() {
    if (!open) setLastListId(window.localStorage.getItem(LAST_LIST_KEY));
    setOpen((v) => !v);
  }

  function remember(listId: string) {
    window.localStorage.setItem(LAST_LIST_KEY, listId);
    setLastListId(listId);
  }

  function pin(listId: string, listName: string) {
    setMessage(null);
    run(() => addRecipesToList(listId, [recipeId]), {
      failure: "Could not pin it.",
      onSuccess: (result) => {
        remember(listId);
        setMessage(
          result.added > 0 ? `Pinned to ${listName}.` : `Already on ${listName}.`,
        );
        setOpen(false);
      },
    });
  }

  function pinToNew() {
    const name = newName.trim();
    if (!name) return;
    setMessage(null);
    run(
      async () => {
        const { id } = await createList(name);
        await addRecipesToList(id, [recipeId]);
        return id;
      },
      {
        failure: "Could not create the list.",
        onSuccess: (id) => {
          remember(id);
          setNewName("");
          setMessage(`Pinned to ${name}.`);
          setOpen(false);
        },
      },
    );
  }

  // Most recently pinned-to list first, so the usual target is at the top.
  const ordered = [...lists].sort((a, b) =>
    a.id === lastListId ? -1 : b.id === lastListId ? 1 : 0,
  );

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={toggleOpen}
        disabled={pending}
      >
        <Pin className="h-4 w-4" /> Pin to list
      </Button>

      {message && <p className="text-sm text-muted-foreground">{message}</p>}

      {open && (
        <div className="flex flex-col gap-2 rounded-xl border p-3">
          {ordered.length > 0 && (
            <ul className="flex max-h-48 flex-col gap-1 overflow-y-auto">
              {ordered.map((list) => (
                <li key={list.id}>
                  <button
                    type="button"
                    onClick={() => pin(list.id, list.name)}
                    disabled={pending}
                    className="flex min-h-11 w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm hover:bg-accent disabled:opacity-50"
                  >
                    <span className="truncate font-medium">{list.name}</span>
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                      {list._count.items}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="flex gap-2 border-t pt-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="New list name"
              aria-label="New list name"
              maxLength={80}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  pinToNew();
                }
              }}
            />
            <Button
              type="button"
              variant="outline"
              onClick={pinToNew}
              disabled={pending || !newName.trim()}
            >
              <Plus className="h-4 w-4" /> Create
            </Button>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      )}
    </div>
  );
}
