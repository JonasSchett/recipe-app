import { Globe, Users } from "lucide-react";
import type { SharedNote } from "@/lib/queries";

/** Notes other people have shared on this recipe. Read-only. */
export function SharedNotes({ notes }: { notes: SharedNote[] }) {
  if (notes.length === 0) return null;

  return (
    <section className="flex flex-col gap-2" aria-label="Notes shared with you">
      {notes.map((note) => {
        const who =
          note.user.name ?? note.user.username ?? note.user.email ?? "Someone";
        const where =
          note.visibility === "PUBLIC"
            ? "shared with everyone"
            : `shared with ${note.groupShares.map(({ group }) => group.name).join(", ")}`;
        const Icon = note.visibility === "PUBLIC" ? Globe : Users;
        return (
          <article
            key={note.user.id}
            className="flex flex-col gap-1 rounded-xl border p-3"
          >
            <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{who}&apos;s note</span>
              <span aria-hidden>·</span>
              <Icon className="h-3.5 w-3.5" />
              {where}
            </p>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{note.body}</p>
          </article>
        );
      })}
    </section>
  );
}
