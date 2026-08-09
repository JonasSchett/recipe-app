"use client";

import { useState } from "react";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { resetUserPassword } from "@/lib/actions/users";
import { useAction } from "@/lib/use-action";

/**
 * Give someone a new starting password. Only shown for accounts that actually
 * have one — a Google account has no password to reset.
 *
 * Resetting signs the account out everywhere and forces a change on next
 * sign-in, so a password an admin knows never stays in use.
 */
export function ResetPasswordButton({
  userId,
  label,
}: {
  userId: string;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [done, setDone] = useState(false);
  const { pending, error, run } = useAction();

  if (!open) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => {
          setOpen(true);
          setDone(false);
        }}
      >
        <KeyRound className="h-4 w-4" /> Reset password
      </Button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="New password"
          aria-label={`New password for ${label}`}
          minLength={10}
          className="w-48"
        />
        <Button
          type="button"
          size="sm"
          disabled={pending || value.length < 10}
          onClick={() =>
            run(() => resetUserPassword(userId, value), {
              failure: "Could not reset the password.",
              onSuccess: () => {
                setDone(true);
                setValue("");
              },
            })
          }
        >
          {pending ? "Saving…" : "Set"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setOpen(false)}
          disabled={pending}
        >
          Close
        </Button>
      </div>
      {done && (
        <p className="text-xs text-muted-foreground">
          Done — they&apos;re signed out everywhere and must change it next
          sign-in.
        </p>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
