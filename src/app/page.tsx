import { auth } from "@/auth";

export default async function Home() {
  const session = await auth();

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="text-4xl font-bold tracking-tight">Recipe App</h1>
      <p className="text-muted-foreground">
        Self-hosted recipe management. The core project scaffold is in place —
        dashboard, recipe CRUD, and filtering come next.
      </p>
      {session?.user ? (
        <p className="text-sm">
          Signed in as <span className="font-medium">{session.user.email}</span>{" "}
          ({session.user.role})
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">Not signed in.</p>
      )}
    </main>
  );
}
