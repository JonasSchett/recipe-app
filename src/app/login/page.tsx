import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FirstRunSetupForm } from "@/components/first-run-setup-form";
import { PasswordSignInForm } from "@/components/password-sign-in-form";
import { CHANGE_PASSWORD_PATH, getCurrentUser } from "@/lib/auth-guards";
import { enabledAuthMethods, passwordIdentifier } from "@/lib/auth-methods";
import { isFirstRunSetupNeeded } from "@/lib/queries";
import { signInWithGoogle } from "@/lib/actions/auth";
import { devSignIn } from "@/lib/actions/dev-auth";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(user.mustChangePassword ? CHANGE_PASSWORD_PATH : "/recipes");

  const isDev = process.env.NODE_ENV !== "production";
  // The operator chooses what this server offers; see AUTH_METHODS. Hiding a
  // card is cosmetic — each action re-checks that its method is enabled.
  const methods = enabledAuthMethods();
  const hasPassword = methods.includes("password");

  // An empty instance with password auth on has no admin and no way to make
  // one, so offer setup instead of a sign-in form nobody could satisfy.
  if (await isFirstRunSetupNeeded()) {
    return (
      <div className="mx-auto flex max-w-sm flex-col gap-4 py-12">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Set up this server</CardTitle>
            <CardDescription>
              No accounts exist yet. Create the first one — it will be an admin,
              and can add everyone else from Account → Manage users.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FirstRunSetupForm identifier={passwordIdentifier()} />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-4 py-12">
      {hasPassword && (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Sign in</CardTitle>
            <CardDescription>
              {passwordIdentifier() === "email"
                ? "Use your email and password."
                : "Use your username and password."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PasswordSignInForm identifier={passwordIdentifier()} />
          </CardContent>
        </Card>
      )}

      {methods.includes("google") && (
        <Card>
          <CardHeader>
            <CardTitle className={hasPassword ? "text-base" : "text-xl"}>
              {hasPassword ? "Or continue with Google" : "Sign in"}
            </CardTitle>
            {!hasPassword && (
              <CardDescription>
                Use your Google account to continue.
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            <form action={signInWithGoogle}>
              <Button
                className="w-full"
                type="submit"
                variant={hasPassword ? "outline" : "default"}
              >
                Continue with Google
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {hasPassword && (
        <p className="text-center text-xs text-muted-foreground">
          Accounts are created by an administrator — ask them to add you, or to
          reset your password if you&apos;re locked out.
        </p>
      )}

      {isDev && (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="text-base">Developer sign-in</CardTitle>
            <CardDescription>
              Local testing only — disabled in production.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={devSignIn} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  defaultValue="dev@local.test"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="role">Role</Label>
                <select
                  id="role"
                  name="role"
                  defaultValue="ADMIN"
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="USER">USER</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
              </div>
              <Button type="submit" variant="secondary">
                Sign in as test user
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
