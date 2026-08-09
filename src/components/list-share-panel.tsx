"use client";

import { useState } from "react";
import { Copy, Link2, Mail, RefreshCw, Share2, UserMinus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  removeListMember,
  revokeListInvite,
  setListMemberRole,
  setListShareLink,
  shareListWithEmail,
} from "@/lib/actions/lists";
import { useAction } from "@/lib/use-action";

type Member = {
  userId: string;
  role: "VIEWER" | "EDITOR";
  user: { id: string; name: string | null; email: string | null };
};

type Invite = { id: string; email: string; role: "VIEWER" | "EDITOR" };

/**
 * Owner-only sharing controls: the secret link, and who currently has access.
 */
export function ListSharePanel({
  listId,
  shareToken,
  shareRole,
  members,
  invites,
  privateRecipeCount,
}: {
  listId: string;
  shareToken: string | null;
  shareRole: "VIEWER" | "EDITOR";
  members: Member[];
  invites: Invite[];
  privateRecipeCount: number;
}) {
  const [copied, setCopied] = useState(false);
  const [email, setEmail] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const { pending, error, run } = useAction();

  const shareUrl = shareToken
    ? `${typeof window === "undefined" ? "" : window.location.origin}/lists/join/${shareToken}`
    : null;

  return (
    <section className="flex flex-col gap-4 rounded-xl border p-4">
      <div className="flex items-center gap-2">
        <Share2 className="h-4 w-4" />
        <h2 className="text-lg font-semibold">Sharing</h2>
      </div>

      {privateRecipeCount > 0 && (
        <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
          {privateRecipeCount} private recipe
          {privateRecipeCount === 1 ? " is" : "s are"} pinned here. Anyone you
          share this list with can view {privateRecipeCount === 1 ? "it" : "them"}
          {" "}— they still can&apos;t edit or delete anything.
        </p>
      )}

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Link2 className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Share link</span>
        </div>

        {shareUrl ? (
          <>
            <div className="flex gap-2">
              <Input readOnly value={shareUrl} aria-label="Share link" />
              <Button
                type="button"
                variant="outline"
                onClick={async () => {
                  await navigator.clipboard.writeText(shareUrl);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
              >
                <Copy className="h-4 w-4" />
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Anyone signed in who opens this link joins as{" "}
              {shareRole === "EDITOR" ? "an editor" : "a viewer"}.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() =>
                  run(() => setListShareLink(listId, true, shareRole), {
                    failure: "Could not rotate the link.",
                  })
                }
              >
                <RefreshCw className="h-4 w-4" /> New link
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() =>
                  run(() => setListShareLink(listId, false), {
                    failure: "Could not turn sharing off.",
                  })
                }
              >
                Turn off
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              “New link” revokes the old one. People who already joined keep
              their access.
            </p>
          </>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() =>
                run(() => setListShareLink(listId, true, "EDITOR"), {
                  failure: "Could not create a link.",
                })
              }
            >
              Create link (can edit)
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() =>
                run(() => setListShareLink(listId, true, "VIEWER"), {
                  failure: "Could not create a link.",
                })
              }
            >
              Create link (view only)
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Share by email</span>
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const value = email.trim();
            if (!value) return;
            setNotice(null);
            run(() => shareListWithEmail(listId, value, "EDITOR"), {
              failure: "Could not share.",
              onSuccess: (result) => {
                setEmail("");
                setNotice(
                  result.status === "added"
                    ? `${result.email} now has access.`
                    : `${result.email} has no account yet — they'll get access the first time they sign in.`,
                );
              },
            });
          }}
        >
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
            aria-label="Email to share with"
          />
          <Button type="submit" variant="outline" disabled={pending || !email.trim()}>
            Share
          </Button>
        </form>
        {notice && <p className="text-sm text-muted-foreground">{notice}</p>}
      </div>

      {invites.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Pending invites</span>
          <ul className="flex flex-col gap-2">
            {invites.map((invite) => (
              <li
                key={invite.id}
                className="flex flex-wrap items-center gap-2 rounded-md border border-dashed p-2"
              >
                <span className="min-w-0 flex-1 truncate text-sm">
                  {invite.email}
                </span>
                <Badge variant="outline">Joins on first sign-in</Badge>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={pending}
                  aria-label={`Revoke invite for ${invite.email}`}
                  onClick={() =>
                    run(() => revokeListInvite(listId, invite.email), {
                      failure: "Could not revoke the invite.",
                    })
                  }
                >
                  <X className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {members.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">People with access</span>
          <ul className="flex flex-col gap-2">
            {members.map((member) => (
              <li
                key={member.userId}
                className="flex flex-wrap items-center gap-2 rounded-md border p-2"
              >
                <span className="min-w-0 flex-1 truncate text-sm">
                  {member.user.name ?? member.user.email}
                </span>
                <Badge variant="secondary">
                  {member.role === "EDITOR" ? "Can edit" : "View only"}
                </Badge>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() =>
                    run(
                      () =>
                        setListMemberRole(
                          listId,
                          member.userId,
                          member.role === "EDITOR" ? "VIEWER" : "EDITOR",
                        ),
                      { failure: "Could not change their role." },
                    )
                  }
                >
                  Make {member.role === "EDITOR" ? "view only" : "editor"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={pending}
                  aria-label={`Remove ${member.user.name ?? member.user.email}`}
                  onClick={() =>
                    run(() => removeListMember(listId, member.userId), {
                      failure: "Could not remove them.",
                    })
                  }
                >
                  <UserMinus className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </section>
  );
}
