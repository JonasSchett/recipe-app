"use client";

import { useState } from "react";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createUserAccount } from "@/lib/actions/users";
import { useAction } from "@/lib/use-action";

/**
 * Admin-only account creation, the sole way a password account comes into
 * existence — there is no self-registration.
 *
 * The starting password is shown back once after saving, because the admin has
 * to relay it out of band and it is unrecoverable afterwards (only its scrypt
 * digest is stored). The account is flagged `mustChangePassword`, so the
 * person replaces it on first sign-in and this value stops working.
 */
export function CreateAccountForm({
  identifier,
}: {
  identifier: "username" | "email";
}) {
  const [open, setOpen] = useState(false);
  const [created, setCreated] = useState<{ id: string; password: string } | null>(
    null,
  );
  const { pending, error, run } = useAction();
  const isEmail = identifier === "email";

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const password = String(data.get("password") ?? "");
    run(
      () =>
        createUserAccount({
          identifier: String(data.get("identifier") ?? ""),
          password,
          name: String(data.get("name") ?? ""),
          role: data.get("role") === "ADMIN" ? "ADMIN" : "USER",
        }),
      {
        failure: "Could not create the account.",
        onSuccess: (result) => {
          setCreated({ id: result.identifier, password });
          form.reset();
        },
      },
    );
  }

  if (!open) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        onClick={() => setOpen(true)}
      >
        <UserPlus className="h-4 w-4" /> Add an account
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border p-4">
      <h2 className="text-base font-semibold">New account</h2>

      {created && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
          <p className="font-medium">Created “{created.id}”.</p>
          <p className="mt-1">
            Starting password:{" "}
            <code className="rounded bg-background px-1 py-0.5 font-mono">
              {created.password}
            </code>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Give it to them now — it isn&apos;t stored and can&apos;t be shown
            again. They&apos;ll be asked to choose their own on first sign-in.
          </p>
        </div>
      )}

      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="new-identifier">{isEmail ? "Email" : "Username"}</Label>
          <Input
            id="new-identifier"
            name="identifier"
            type={isEmail ? "email" : "text"}
            autoCapitalize="none"
            spellCheck={false}
            placeholder={isEmail ? "name@example.com" : "anna"}
            required
          />
          {!isEmail && (
            <p className="text-xs text-muted-foreground">
              3–32 characters: letters, numbers, and . _ -
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="new-name">Display name (optional)</Label>
          <Input id="new-name" name="name" placeholder="Anna" />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="new-password">Starting password</Label>
          <Input
            id="new-password"
            name="password"
            type="text"
            autoComplete="off"
            minLength={10}
            required
          />
          <p className="text-xs text-muted-foreground">
            At least 10 characters. Shown as plain text so you can copy it.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="new-role">Role</Label>
          <select
            id="new-role"
            name="role"
            defaultValue="USER"
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="USER">USER</option>
            <option value="ADMIN">ADMIN</option>
          </select>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex flex-wrap gap-2">
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Creating…" : "Create account"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              setOpen(false);
              setCreated(null);
            }}
            disabled={pending}
          >
            Done
          </Button>
        </div>
      </form>
    </div>
  );
}
