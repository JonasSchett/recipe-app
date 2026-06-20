"use client";

import Link from "next/link";
import { useState } from "react";
import { ChefHat, Menu, X } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { signOutAction } from "@/lib/actions/auth";
import { cn } from "@/lib/utils";

type NavUser = { name?: string | null; email?: string | null } | null;

const authedLinks = [
  { href: "/recipes", label: "All Recipes" },
  { href: "/recipes/new", label: "Create Recipe" },
  { href: "/tags", label: "All Tags" },
  { href: "/account", label: "Account" },
];

export function Navbar({ user }: { user: NavUser }) {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <ChefHat className="h-5 w-5" />
          <span>Recipe App</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 md:flex">
          {user ? (
            <>
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
