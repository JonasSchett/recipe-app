"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ChefHat, Menu, Search, X } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { signOutAction } from "@/lib/actions/auth";
import { cn } from "@/lib/utils";

type NavUser = {
  name?: string | null;
  email?: string | null;
  role?: "ADMIN" | "USER";
} | null;

/** Global search: submits to the recipe list with the term pre-applied. */
function NavSearch({
  className,
  onNavigate,
}: {
  className?: string;
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const [term, setTerm] = useState("");

  return (
    <form
      role="search"
      className={cn("relative", className)}
      onSubmit={(e) => {
        e.preventDefault();
        const q = term.trim();
        router.push(q ? `/recipes?q=${encodeURIComponent(q)}` : "/recipes");
        onNavigate?.();
      }}
    >
      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
      <Input
        type="search"
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        placeholder="Search recipes…"
        aria-label="Search recipes"
        className="pl-8"
      />
    </form>
  );
}

export function Navbar({ user }: { user: NavUser }) {
  const [open, setOpen] = useState(false);

  const authedLinks = [
    { href: "/recipes", label: "All Recipes" },
    { href: "/lists", label: "Pinned Lists" },
    { href: "/favourite-tags", label: "Favourite Tags" },
    { href: "/recipes/new", label: "Create Recipe" },
    { href: "/tags", label: "All Tags" },
    ...(user?.role === "ADMIN"
      ? [{ href: "/admin/users", label: "Admin" }]
      : []),
    { href: "/account", label: "Account" },
  ];

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <ChefHat className="h-5 w-5" />
          <span>Recipe App</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 md:flex">
          {user ? (
            <>
              <NavSearch className="w-40 lg:w-56" />
              {authedLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
                >
                  {link.label}
                </Link>
              ))}
              <form action={signOutAction}>
                <button className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <Link href="/login" className={cn(buttonVariants({ size: "sm" }))}>
              Sign in
            </Link>
          )}
        </nav>

        {/* Mobile hamburger */}
        <button
          className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "md:hidden")}
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
          aria-expanded={open}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <nav className="flex flex-col gap-1 border-t p-4 md:hidden">
          {user ? (
            <>
              <NavSearch className="mb-2" onNavigate={() => setOpen(false)} />
              {authedLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className={cn(buttonVariants({ variant: "ghost" }), "justify-start")}
                >
                  {link.label}
                </Link>
              ))}
              <form action={signOutAction}>
                <button
                  className={cn(buttonVariants({ variant: "outline" }), "w-full")}
                >
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className={cn(buttonVariants(), "w-full")}
            >
              Sign in
            </Link>
          )}
        </nav>
      )}
    </header>
  );
}
