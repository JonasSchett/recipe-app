"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signInWithPassword } from "@/lib/actions/password-auth";
import { useAction } from "@/lib/use-action";

/**
 * Identifier + password sign-in. `identifier` is a username or an email
 * depending on the server's `AUTH_PASSWORD_IDENTIFIER`; only the label and the
 * input type change, never the check.
 *
 * On success the action redirects, so there is nothing to do here — hence
 * `refresh: false`, which would otherwise fight the navigation.
 */
export function PasswordSignInForm({
  identifier,
}: {
  identifier: "username" | "email";
}) {
  const { pending, error, run } = useAction();
  const isEmail = identifier === "email";

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    run(() => signInWithPassword(data), {
      failure: "Could not sign in.",
      refresh: false,
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="identifier">{isEmail ? "Email" : "Username"}</Label>
        <Input
          id="identifier"
          name="identifier"
          type={isEmail ? "email" : "text"}
          autoComplete={isEmail ? "email" : "username"}
          autoCapitalize="none"
          spellCheck={false}
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button className="w-full" type="submit" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
