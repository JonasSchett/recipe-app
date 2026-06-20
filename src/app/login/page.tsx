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
import { getCurrentUser } from "@/lib/auth-guards";
import { signInWithGoogle } from "@/lib/actions/auth";
import { devSignIn } from "@/lib/actions/dev-auth";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/recipes");

  const isDev = process.env.NODE_ENV !== "production";

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-4 py-12">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Sign in</CardTitle>
          <CardDescription>Use your Google account to continue.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={signInWithGoogle}>
            <Button className="w-full" type="submit">
              Continue with Google
            </Button>
          </form>
        </CardContent>
      </Card>

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
