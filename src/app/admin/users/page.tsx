import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CreateAccountForm } from "@/components/create-account-form";
import { GoogleAllowlistPanel } from "@/components/google-allowlist-panel";
import { ResetPasswordButton } from "@/components/reset-password-button";
import { UserRoleToggle } from "@/components/user-role-toggle";
import { isAdmin, requirePageUser } from "@/lib/auth-guards";
import { isAuthMethodEnabled, passwordIdentifier } from "@/lib/auth-methods";
import { getAllUsers, getGoogleAllowlist } from "@/lib/queries";

export default async function AdminUsersPage() {
  const user = await requirePageUser();
  if (!isAdmin(user)) redirect("/");

  const googleAuth = isAuthMethodEnabled("google");
  const passwordAuth = isAuthMethodEnabled("password");
  const [users, allowlist] = await Promise.all([
    getAllUsers(),
    // Only meaningful where Google sign-in is actually offered.
    googleAuth ? getGoogleAllowlist() : Promise.resolve(null),
  ]);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Users</h1>
        <p className="text-sm text-muted-foreground">
          Manage who has admin access. Admins can edit and delete any recipe.
        </p>
      </div>

      {allowlist && (
        <GoogleAllowlistPanel
          entries={allowlist.entries}
          fromEnv={allowlist.fromEnv}
          open={allowlist.open}
        />
      )}

      {/* Account creation only exists where password sign-in is turned on —
          Google accounts create themselves on first sign-in. */}
      {passwordAuth && <CreateAccountForm identifier={passwordIdentifier()} />}

      <Card>
        <CardContent className="flex flex-col divide-y p-0">
          {users.map((u) => (
            <div key={u.id} className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate font-medium">
                    {u.name ?? u.username ?? u.email ?? "Unknown"}
                  </span>
                  <Badge variant={u.role === "ADMIN" ? "default" : "secondary"}>
                    {u.role}
                  </Badge>
                  {u.mustChangePassword && (
                    <Badge variant="outline">Must change password</Badge>
                  )}
                </div>
                {(u.username || u.email) && (
                  <p className="truncate text-sm text-muted-foreground">
                    {u.username ?? u.email}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  {u._count.recipes} recipe{u._count.recipes === 1 ? "" : "s"}
                  {u.hasPassword ? " · password" : " · Google"}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {passwordAuth && u.hasPassword && (
                  <ResetPasswordButton
                    userId={u.id}
                    label={u.username ?? u.email ?? "this account"}
                  />
                )}
                <UserRoleToggle
                  userId={u.id}
                  role={u.role}
                  isSelf={u.id === user.id}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
