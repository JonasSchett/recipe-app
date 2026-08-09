import { redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ChangePasswordForm } from "@/components/change-password-form";
import { requireUserPendingPasswordChange } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";

/**
 * Where `requirePageUser` sends anyone still carrying an admin-set password,
 * and where an ordinary user changes theirs by choice.
 *
 * Guarded with `requireUserPendingPasswordChange` rather than `requirePageUser`,
 * which would bounce the very people this page exists for straight back here.
 */
export default async function ChangePasswordPage() {
  const user = await requireUserPendingPasswordChange();

  // A Google account has no password, so there is nothing to change.
  const account = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { passwordHash: true },
  });
  if (!account.passwordHash) redirect("/account");

  const forced = user.mustChangePassword;

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-4 py-12">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">
            {forced ? "Choose your password" : "Change your password"}
          </CardTitle>
          <CardDescription>
            {forced
              ? "Your account was set up with a temporary password. Pick your own to continue."
              : "Signing in elsewhere will need the new password."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm forced={forced} />
        </CardContent>
      </Card>
    </div>
  );
}
