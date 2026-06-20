import Link from "next/link";
import { redirect } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth-guards";

export default async function Home() {
  const user = await getCurrentUser();
  if (user) redirect("/recipes");

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-6 py-16 text-center">
      <h1 className="text-4xl font-bold tracking-tight">Recipe App</h1>
      <p className="text-muted-foreground">
        Manage, share, and view your recipes. Sign in to get started.
      </p>
      <Link href="/login" className={buttonVariants({ size: "lg" })}>
        Sign in
      </Link>
    </div>
  );
}
