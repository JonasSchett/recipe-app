"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { NotebookPen, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { saveRecipeNote, deleteRecipeNote } from "@/lib/actions/notes";

/**
 * The current user's private note on a recipe — one notepad per person, not a
 * comment thread. Collapses to a single button when empty so it stays out of
 * the way while cooking, and reads as plain text until you choose to edit.
 */
export function RecipeNote({
  recipeId,
  initialBody,
}: {
  recipeId: string;
  initialBody: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [body, setBody] = useState(initialBody ?? "");
  const [draft, setDraft] = useState(initialBody ?? "");
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function save() {
    setError(null);
    startTransition(async () => {
      try {
        const next = draft.trim();
        await saveRecipeNote(recipeId, next);
        setBody(next);
        setEditing(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save the note.");
      }
    });
  }

  function remove() {
    if (!confirm("Delete this note?")) return;
    setError(null);
    startTransition(async () => {
      try {
        await deleteRecipeNote(recipeId);
        setBody("");
        setDraft("");
        setEditing(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete the note.");
      }
    });
  }

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl font-semibold">My notes</h2>
        <span className="text-xs text-muted-foreground">Private to you</span>
      </div>

      {editing ? (
        <>
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="min-h-32"
            placeholder="Halve the sugar. Needed 10 minutes longer than stated."
            aria-label="Note"
            autoFocus
          />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={save} disabled={pending}>
              {pending ? "Saving…" : "Save note"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setDraft(body);
                setEditing(false);
                setError(null);
              }}
              disabled={pending}
            >
              Cancel
            </Button>
          </div>
        </>
      ) : body ? (
        <>
          <p className="whitespace-pre-wrap rounded-md border bg-muted/40 px-3 py-2 text-sm leading-relaxed">
            {body}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setEditing(true)}
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
      ) : (
        <Button
          size="sm"
          variant="outline"
          className="self-start"
          onClick={() => setEditing(true)}
        >
          <NotebookPen className="h-4 w-4" /> Add a note
        </Button>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </section>
  );
}
