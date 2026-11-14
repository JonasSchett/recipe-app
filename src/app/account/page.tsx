import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UserSettingsForm } from "@/components/user-settings-form";
import { ShareExistingPanel } from "@/components/share-existing-panel";
import { requirePageUser } from "@/lib/auth-guards";
import {
  getMyGroups,
  getShareExistingCounts,
  getUserSettings,
} from "@/lib/queries";
import { signOutAction } from "@/lib/actions/auth";
import { cn } from "@/lib/utils";

export default async function AccountPage() {
  const user = await requirePageUser();

  const [settings, groups, existing] = await Promise.all([
    getUserSettings(),
    getMyGroups(),
    getShareExistingCounts(),
  ]);

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-tight">Account</h1>
      <Card>
        <CardHeader>
          <CardTitle>{user.name ?? "Signed in"}</CardTitle>
          {/* A password account may have no email, and a Google account has no
              username — show whichever identifies this one. */}
          <CardDescription>
            {user.email ?? settings.username ?? "Signed in"}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Role</span>
            <Badge variant={user.role === "ADMIN" ? "default" : "secondary"}>
              {user.role}
            </Badge>
          </div>
          {settings.hasPassword && (
            <Link
              href="/change-password"
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              Change password
            </Link>
          )}
          {user.role === "ADMIN" && (
            <Link
              href="/admin/users"
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              Manage users
            </Link>
          )}
          <form action={signOutAction}>
            <Button variant="outline" type="submit">
              Sign out
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sharing defaults</CardTitle>
          <CardDescription>Who your new recipes and notes are shared with.</CardDescription>
        </CardHeader>
        <CardContent>
          <UserSettingsForm
            defaultRecipeVisibility={settings.defaultRecipeVisibility}
            defaultNoteVisibility={settings.defaultNoteVisibility}
            groups={groups}
          />
        </CardContent>
      </Card>

      <ShareExistingPanel everyone={existing.everyone} groups={existing.groups} />
    </div>
  );
}
