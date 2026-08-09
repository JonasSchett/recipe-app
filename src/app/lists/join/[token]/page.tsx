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
import { getListByShareToken } from "@/lib/queries";
import { joinListByToken } from "@/lib/actions/lists";
import { cn } from "@/lib/utils";

/**
 * Landing page for a share link.
 *
 * Joining happens on an explicit button press, not on page load: a GET should
 * not change who can see your data, and link previews and prefetchers follow
 * URLs with no person behind them.
 *
 * A rotated or switched-off link is an ordinary outcome, not a crash — the
 * page resolves the token first and says so plainly.
 */
export default async function JoinListPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const user = await getCurrentUser();
  // Come back here after signing in, so a link sent to someone without a
  // session still lands them on the list.
  if (!user) redirect(`/login?callbackUrl=/lists/join/${token}`);
  if (user.mustChangePassword) redirect(CHANGE_PASSWORD_PATH);

  const list = await getListByShareToken(token);

  if (!list) {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-6 py-8">
        <Card>
          <CardHeader>
            <CardTitle>This share link is no longer valid</CardTitle>
            <CardDescription>
              It was turned off or replaced with a new one. Ask whoever shared
              the list for an up-to-date link.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/lists" className={cn(buttonVariants({ variant: "outline" }))}>
              Go to my lists
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  async function join() {
    "use server";
    let listId: string | null = null;
    try {
      ({ listId } = await joinListByToken(token));
    } catch {
      // The link can be revoked between this page rendering and the click.
      // Fall back to re-rendering, which then shows the message above.
      listId = null;
    }
    // Outside the try: redirect() signals by throwing, so catching it would
    // swallow the navigation.
    redirect(listId ? `/lists/${listId}` : `/lists/join/${token}`);
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 py-8">
      <Card>
        <CardHeader>
          <CardTitle>Join “{list.name}”</CardTitle>
          <CardDescription>
            {list.owner.name ?? list.owner.email ?? "Someone"} shared this
            pinned recipe list with you · {list._count.items} recipe
            {list._count.items === 1 ? "" : "s"}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            You&apos;ll join as{" "}
            {list.shareRole === "EDITOR"
              ? "an editor, so you can pin and unpin recipes"
              : "a viewer, so you can read the list but not change it"}
            . You may be able to see private recipes pinned here; they stay
            read-only.
          </p>
          <form action={join}>
            <Button type="submit">Join the list</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
