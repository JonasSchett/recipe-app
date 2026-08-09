"use client";

import { useRouter } from "next/navigation";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changeMyPassword } from "@/lib/actions/password-auth";
import { useAction } from "@/lib/use-action";

/**
 * Choose a new password.
 *
 * `forced` is set when an admin issued the current password: the current-password
 * field is dropped, since the user was handed that password and typing it back
 * proves nothing. Otherwise it is required, so someone on a borrowed session
 * can't silently take the account over.
 */
export function ChangePasswordForm({ forced }: { forced: boolean }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const { pending, error, run } = useAction();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    run(() => changeMyPassword(data), {
      failure: "Could not change your password.",
      // We navigate away, and a refresh in the same transition re-renders this
      // route instead — which left the user sitting on the form.
      refresh: false,
      onSuccess: () => {
        formRef.current?.reset();
        router.replace(forced ? "/recipes" : "/account");
      },
    });
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-4">
      {!forced && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="currentPassword">Current password</Label>
          <Input
            id="currentPassword"
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="newPassword">New password</Label>
        <Input
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          minLength={10}
          required
        />
        <p className="text-xs text-muted-foreground">At least 10 characters.</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="confirmPassword">Confirm new password</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          minLength={10}
          required
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Set new password"}
      </Button>
    </form>
  );
}
