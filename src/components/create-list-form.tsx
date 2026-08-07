"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createList } from "@/lib/actions/lists";

/** Create a new list and go straight to it. */
export function CreateListForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = name.trim();
    if (!value) return;
    setError(null);
    startTransition(async () => {
      try {
        const { id } = await createList(value);
        setName("");
        router.push(`/lists/${id}`);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not create the list.");
      }
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Week of 10 August"
          aria-label="New list name"
          maxLength={80}
        />
        <Button type="submit" disabled={pending || !name.trim()}>
          <Plus className="h-4 w-4" />
          {pending ? "Creating…" : "New list"}
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </form>
  );
}
