"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { heartTag, unheartTag } from "@/lib/actions/tags";
import { cn } from "@/lib/utils";

export function TagHeartButton({
  tagId,
  hearted,
}: {
  tagId: string;
  hearted: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      if (hearted) await unheartTag(tagId);
      else await heartTag(tagId);
      router.refresh();
    });
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      disabled={pending}
      aria-label={hearted ? "Remove from hearted tags" : "Heart this tag"}
      aria-pressed={hearted}
    >
      <Heart
        className={cn(
          "h-5 w-5",
          hearted && "fill-red-500 text-red-500",
        )}
      />
    </Button>
  );
}
