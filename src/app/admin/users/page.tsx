import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { UserRoleToggle } from "@/components/user-role-toggle";
import { getCurrentUser, isAdmin } from "@/lib/auth-guards";
import { getAllUsers } from "@/lib/queries";

export default async function AdminUsersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isAdmin(user)) redirect("/");

  const users = await getAllUsers();

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Users</h1>
        <p className="text-sm text-muted-foreground">
          Manage who has admin access. Admins can edit and delete any recipe and
          manage tags and ingredients.
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-col divide-y p-0">
          {users.map((u) => (
            <div key={u.id} className="flex items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium">
                    {u.name ?? u.email ?? "Unknown"}
                  </span>
                  <Badge variant={u.role === "ADMIN" ? "default" : "secondary"}>
                    {u.role}
                  </Badge>
                </div>
                {u.email && (
                  <p className="truncate text-sm text-muted-foreground">
                    {u.email}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  {u._count.recipes} recipe{u._count.recipes === 1 ? "" : "s"}
                </p>
              </div>
              <UserRoleToggle
                userId={u.id}
                role={u.role}
                isSelf={u.id === user.id}
              />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
