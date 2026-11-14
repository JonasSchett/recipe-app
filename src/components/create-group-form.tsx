"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createGroup } from "@/lib/actions/groups";
import { useAction } from "@/lib/use-action";

/** Create a family group and go straight to it to invite people. */
export function CreateGroupForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const { pending, error, run } = useAction();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = name.trim();
    if (!value) return;
    run(() => createGroup(value), {
      failure: "Could not create the group.",
      onSuccess: ({ id }) => {
        setName("");
        router.push(`/groups/${id}`);
      },
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Group Name"
          aria-label="New group name"
          maxLength={80}
        />
        <Button type="submit" disabled={pending || !name.trim()}>
          <Plus className="h-4 w-4" />
          {pending ? "Creating…" : "New group"}
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </form>
  );
}
