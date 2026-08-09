"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createFirstAdmin } from "@/lib/actions/password-auth";
import { useAction } from "@/lib/use-action";

/**
 * Shown on /login only while the database has no accounts at all. Creates the
 * first admin and signs in as them, which is how a password-only deployment
 * gets its first way in.
 */
export function FirstRunSetupForm({
  identifier,
}: {
  identifier: "username" | "email";
}) {
  const { pending, error, run } = useAction();
  const isEmail = identifier === "email";

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    // The action redirects on success, so a refresh would only race it.
    run(() => createFirstAdmin(data), {
      failure: "Could not complete setup.",
      refresh: false,
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="setup-identifier">{isEmail ? "Email" : "Username"}</Label>
        <Input
          id="setup-identifier"
          name="identifier"
          type={isEmail ? "email" : "text"}
          autoCapitalize="none"
          spellCheck={false}
          placeholder={isEmail ? "you@example.com" : "admin"}
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="setup-password">Password</Label>
        <Input
          id="setup-password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={10}
          required
        />
        <p className="text-xs text-muted-foreground">At least 10 characters.</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="setup-confirm">Confirm password</Label>
        <Input
          id="setup-confirm"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          minLength={10}
          required
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button className="w-full" type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create admin account"}
      </Button>
    </form>
  );
}
