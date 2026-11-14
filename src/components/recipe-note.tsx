"use client";

import { useState } from "react";
import { Globe, Lock, NotebookPen, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  GroupSharePicker,
  type PickableGroup,
} from "@/components/group-share-picker";
import { saveRecipeNote, deleteRecipeNote } from "@/lib/actions/notes";
import { useAction } from "@/lib/use-action";

type Sharing = { visibility: "PRIVATE" | "PUBLIC"; groupIds: string[] };

/** One line saying who can read the note. */
function describeSharing(sharing: Sharing, groups: PickableGroup[]) {
  if (sharing.visibility === "PUBLIC") {
    return { Icon: Globe, text: "Shared with everyone who can see this recipe" };
  }
  const names = groups
    .filter((group) => sharing.groupIds.includes(group.id))
    .map((group) => group.name);
  if (names.length > 0) {
    return { Icon: Users, text: `Shared with ${names.join(", ")}` };
  }
  return { Icon: Lock, text: "Private to you" };
}

/**
 * The current user's note on a recipe — one notepad per person, not a comment
 * thread. Private unless they choose otherwise: it can be shared with everyone
 * who can see the recipe, and/or with any of their family groups.
 *
 * A note that doesn't exist yet starts from the account defaults (`defaults`);
 * an existing note always shows what it was saved with.
 */
export function RecipeNote({
  recipeId,
  initial,
  groups,
  defaults,
}: {
  recipeId: string;
  initial: ({ body: string } & Sharing) | null;
  groups: PickableGroup[];
  defaults: Sharing;
}) {
  const [body, setBody] = useState(initial?.body ?? "");
  const [sharing, setSharing] = useState<Sharing>(
    initial
      ? { visibility: initial.visibility, groupIds: initial.groupIds }
      : defaults,
  );
  const [draft, setDraft] = useState(body);
  const [draftSharing, setDraftSharing] = useState<Sharing>(sharing);
  const [editing, setEditing] = useState(false);
  const { pending, error, setError, run } = useAction();

  function startEditing() {
    setDraft(body);
    setDraftSharing(sharing);
    setEditing(true);
  }

  function save() {
    const next = draft.trim();
    run(() => saveRecipeNote(recipeId, next, draftSharing), {
      failure: "Failed to save the note.",
      onSuccess: () => {
        setBody(next);
        // Emptying the note deletes it, so the next one starts from defaults.
        setSharing(next ? draftSharing : defaults);
        setEditing(false);
      },
    });
  }

  function remove() {
    if (!confirm("Delete this note?")) return;
    run(() => deleteRecipeNote(recipeId), {
      failure: "Failed to delete the note.",
      onSuccess: () => {
        setBody("");
        setDraft("");
        setSharing(defaults);
        setEditing(false);
      },
    });
  }

  const status = describeSharing(editing ? draftSharing : sharing, groups);

  if (!editing && !body) {
    return (
      <div className="flex flex-col gap-1">
        <Button
          size="sm"
          variant="outline"
          className="self-start"
          onClick={startEditing}
        >
          <NotebookPen className="h-4 w-4" /> Add a note
        </Button>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-2 rounded-xl border bg-muted/30 p-3">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h2 className="flex items-center gap-1.5 text-base font-semibold">
          <NotebookPen className="h-4 w-4" /> My note
        </h2>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <status.Icon className="h-3.5 w-3.5" /> {status.text}
        </span>
      </div>

      {editing ? (
        <>
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="min-h-32 bg-background"
            placeholder="Halve the sugar. Needed 10 minutes longer than stated."
            aria-label="Note"
            autoFocus
          />
          <div className="flex flex-col gap-3 rounded-md border bg-background p-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={draftSharing.visibility === "PUBLIC"}
                onChange={(e) =>
                  setDraftSharing((s) => ({
                    ...s,
                    visibility: e.target.checked ? "PUBLIC" : "PRIVATE",
                  }))
                }
              />
              Share with everyone who can see this recipe
            </label>
            <GroupSharePicker
              groups={groups}
              selected={draftSharing.groupIds}
              onChange={(groupIds) => setDraftSharing((s) => ({ ...s, groupIds }))}
              label="Share with family groups"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={save} disabled={pending}>
              {pending ? "Saving…" : "Save note"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setEditing(false);
                setError(null);
              }}
              disabled={pending}
            >
              Cancel
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{body}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={startEditing}
              disabled={pending}
            >
              <NotebookPen className="h-4 w-4" /> Edit note
            </Button>
            {/* "Delete note", not "Delete": RecipeActions puts a destructive
                Delete (the whole recipe) on this same page, and two identically
                labelled buttons a few hundred pixels apart is a real misclick
                risk — one is undoable, the other is not. */}
            <Button
              size="sm"
              variant="ghost"
              onClick={remove}
              disabled={pending}
            >
              <Trash2 className="h-4 w-4" /> Delete note
            </Button>
          </div>
        </>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </section>
  );
}
