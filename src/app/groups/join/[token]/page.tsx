import Link from "next/link";
import { redirect } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CHANGE_PASSWORD_PATH, getCurrentUser } from "@/lib/auth-guards";
import { getGroupByShareToken } from "@/lib/queries";
import { joinGroupByToken } from "@/lib/actions/groups";
import { cn } from "@/lib/utils";

/**
 * Landing page for a group invite link. Joining is an explicit button press,
 * never a side effect of the GET — link previews and prefetchers follow URLs
 * with nobody behind them. (Same reasoning as /lists/join.)
 */
export default async function JoinGroupPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?callbackUrl=/groups/join/${token}`);
  if (user.mustChangePassword) redirect(CHANGE_PASSWORD_PATH);

  const group = await getGroupByShareToken(token);

  if (!group) {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-6 py-8">
        <Card>
          <CardHeader>
            <CardTitle>This invite link is no longer valid</CardTitle>
            <CardDescription>
              It was turned off or replaced with a new one. Ask whoever invited
              you for an up-to-date link.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/groups" className={cn(buttonVariants({ variant: "outline" }))}>
              Go to my groups
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  async function join() {
    "use server";
    let groupId: string | null = null;
    try {
      ({ groupId } = await joinGroupByToken(token));
    } catch {
      // Revoked between render and click — re-render shows the message above.
      groupId = null;
    }
    // Outside the try: redirect() signals by throwing.
    redirect(groupId ? `/groups/${groupId}` : `/groups/join/${token}`);
  }

  const owner = group.owner.name ?? group.owner.username ?? group.owner.email ?? "Someone";

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 py-8">
      <Card>
        <CardHeader>
          <CardTitle>Join “{group.name}”</CardTitle>
          <CardDescription>
            {owner} invited you to their family group · {group._count.members}{" "}
            member{group._count.members === 1 ? "" : "s"}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            You&apos;ll be able to read recipes and notes members share with the
            group. Nothing of yours is shared until you choose to.
          </p>
          <form action={join}>
            <Button type="submit">Join the group</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
