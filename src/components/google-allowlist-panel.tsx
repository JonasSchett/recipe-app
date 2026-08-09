"use client";

import { useState } from "react";
import { Lock, Plus, ShieldAlert, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { allowGoogleEmail, disallowGoogleEmail } from "@/lib/actions/users";
import { useAction } from "@/lib/use-action";

type Entry = { id: string; email: string };

/**
 * Who may sign in with Google, editable without touching `.env`.
 *
 * Entries from `AUTH_ALLOWED_EMAILS` are shown but not removable — they come
 * from the environment, and keeping them here is what stops an admin locking
 * themselves out by clearing the list.
 */
export function GoogleAllowlistPanel({
  entries,
  fromEnv,
  open,
}: {
  entries: Entry[];
  fromEnv: string[];
  /** True when nothing restricts sign-in, so any Google account is accepted. */
  open: boolean;
}) {
  const [email, setEmail] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const { pending, error, run } = useAction();

  function add(e: React.FormEvent) {
    e.preventDefault();
    const value = email.trim();
    if (!value) return;
    setNotice(null);
    run(() => allowGoogleEmail(value), {
      failure: "Could not add that address.",
      onSuccess: (result) => {
        setEmail("");
        setNotice(`${result.email} can now sign in with Google.`);
      },
    });
  }

  function remove(address: string) {
    setNotice(null);
    run(() => disallowGoogleEmail(address), {
      failure: "Could not remove that address.",
      onSuccess: (result) =>
        setNotice(
          result.signedOut
            ? `${result.email} removed and signed out everywhere.`
            : `${result.email} removed.`,
        ),
    });
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border p-4">
      <div className="flex items-center gap-2">
        <Lock className="h-4 w-4" />
        <h2 className="text-base font-semibold">Google sign-in access</h2>
      </div>

      {open ? (
        <p className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <strong>Anyone with a Google account can sign in.</strong> The list
            is empty, which means no restriction. Adding the first address below
            locks sign-in to the listed people — including you, so add your own
            address too.
          </span>
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Only these addresses may sign in with Google.
        </p>
      )}

      <form className="flex gap-2" onSubmit={add}>
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@example.com"
          aria-label="Email to allow"
          autoCapitalize="none"
          spellCheck={false}
        />
        <Button type="submit" variant="outline" disabled={pending || !email.trim()}>
          <Plus className="h-4 w-4" /> Allow
        </Button>
      </form>

      {(entries.length > 0 || fromEnv.length > 0) && (
        <ul className="flex flex-col gap-2">
          {fromEnv.map((address) => (
            <li
              key={`env-${address}`}
              className="flex flex-wrap items-center gap-2 rounded-md border border-dashed p-2"
            >
              <span className="min-w-0 flex-1 truncate text-sm">{address}</span>
              <Badge variant="outline">from .env</Badge>
            </li>
          ))}
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="flex flex-wrap items-center gap-2 rounded-md border p-2"
            >
              <span className="min-w-0 flex-1 truncate text-sm">{entry.email}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={pending}
                aria-label={`Remove ${entry.email}`}
                onClick={() => remove(entry.email)}
              >
                <X className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {fromEnv.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Addresses marked “from .env” come from <code>AUTH_ALLOWED_EMAILS</code>{" "}
          and can only be changed there. They stay allowed regardless of this
          list, so you can&apos;t lock yourself out.
        </p>
      )}

      <p className="text-xs text-muted-foreground">
        Removing someone also signs them out immediately. Their recipes and lists
        are kept.
      </p>

      {notice && <p className="text-sm text-muted-foreground">{notice}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </section>
  );
}
