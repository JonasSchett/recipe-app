"use client";

import { useState } from "react";
import { Copy, Crown, Link2, Mail, RefreshCw, UserMinus, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  inviteToGroup,
  removeGroupMember,
  revokeGroupInvite,
  setGroupShareLink,
} from "@/lib/actions/groups";
import { useAction } from "@/lib/use-action";

type Member = {
  userId: string;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    username: string | null;
  };
};

type Invite = { id: string; email: string };

function displayName(user: Member["user"]): string {
  return user.name ?? user.username ?? user.email ?? "Someone";
}

/**
 * Members of a group. The owner also gets the invite controls: a join link,
 * invite by email/username, pending invites, and removing people.
 */
export function GroupMembersPanel({
  groupId,
  ownerId,
  viewerId,
  members,
  invites,
  shareToken,
}: {
  groupId: string;
  ownerId: string;
  viewerId: string;
  members: Member[];
  invites: Invite[];
  shareToken: string | null;
}) {
  const isOwner = viewerId === ownerId;
  const [copied, setCopied] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const { pending, error, run } = useAction();

  const joinUrl = shareToken
    ? `${typeof window === "undefined" ? "" : window.location.origin}/groups/join/${shareToken}`
    : null;

  return (
    <section className="flex flex-col gap-4 rounded-xl border p-4">
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4" />
        <h2 className="text-lg font-semibold">Members</h2>
      </div>

      <ul className="flex flex-col gap-2">
        {members.map((member) => (
          <li
            key={member.userId}
            className="flex flex-wrap items-center gap-2 rounded-md border p-2"
          >
            <span className="min-w-0 flex-1 truncate text-sm">
              {displayName(member.user)}
              {member.userId === viewerId && " (you)"}
            </span>
            {member.userId === ownerId && (
              <Badge variant="secondary" className="gap-1">
                <Crown className="h-3 w-3" /> Owner
              </Badge>
            )}
            {isOwner && member.userId !== ownerId && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={pending}
                aria-label={`Remove ${displayName(member.user)}`}
                onClick={() => {
                  if (
                    !confirm(
                      `Remove ${displayName(member.user)}? What they shared with the group stops being shared.`,
                    )
                  )
                    return;
                  run(() => removeGroupMember(groupId, member.userId), {
                    failure: "Could not remove them.",
                  });
                }}
              >
                <UserMinus className="h-4 w-4" />
              </Button>
            )}
          </li>
        ))}
      </ul>

      {isOwner && (
        <>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Invite a person</span>
            </div>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const value = identifier.trim();
                if (!value) return;
                setNotice(null);
                run(() => inviteToGroup(groupId, value), {
                  failure: "Could not invite.",
                  onSuccess: (result) => {
                    setIdentifier("");
                    setNotice(
                      result.status === "added"
                        ? `${result.identifier} is now in the group.`
                        : `${result.identifier} has no account yet — they'll join the first time they sign in.`,
                    );
                  },
                });
              }}
            >
              <Input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="name@example.com or username"
                aria-label="Email or username to invite"
                autoCapitalize="none"
                spellCheck={false}
              />
              <Button
                type="submit"
                variant="outline"
                disabled={pending || !identifier.trim()}
              >
                Invite
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
                        run(() => revokeGroupInvite(groupId, invite.email), {
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

          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Link2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Invite link</span>
            </div>
            {joinUrl ? (
              <>
                <div className="flex gap-2">
                  <Input readOnly value={joinUrl} aria-label="Invite link" />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={async () => {
                      await navigator.clipboard.writeText(joinUrl);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                  >
                    <Copy className="h-4 w-4" />
                    {copied ? "Copied" : "Copy"}
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    onClick={() =>
                      run(() => setGroupShareLink(groupId, true), {
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
                      run(() => setGroupShareLink(groupId, false), {
                        failure: "Could not turn the link off.",
                      })
                    }
                  >
                    Turn off
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Anyone signed in who opens this link joins the group. “New
                  link” revokes the old one; people who already joined stay.
                </p>
              </>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="self-start"
                disabled={pending}
                onClick={() =>
                  run(() => setGroupShareLink(groupId, true), {
                    failure: "Could not create a link.",
                  })
                }
              >
                Create invite link
              </Button>
            )}
          </div>
        </>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </section>
  );
}
