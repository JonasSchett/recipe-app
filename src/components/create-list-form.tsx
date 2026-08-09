"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createList } from "@/lib/actions/lists";
import { useAction } from "@/lib/use-action";

/** Create a new list and go straight to it. */
export function CreateListForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const { pending, error, run } = useAction();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = name.trim();
    if (!value) return;
    run(() => createList(value), {
      failure: "Could not create the list.",
      onSuccess: ({ id }) => {
        setName("");
        router.push(`/lists/${id}`);
      },
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
