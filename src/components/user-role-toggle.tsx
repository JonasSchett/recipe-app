"use client";

import { ShieldCheck, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setUserRole } from "@/lib/actions/users";
import { useAction } from "@/lib/use-action";

export function UserRoleToggle({
  userId,
  role,
  isSelf,
}: {
  userId: string;
  role: "ADMIN" | "USER";
  isSelf: boolean;
}) {
  const { pending, error, run } = useAction();

  // Your own role can't be changed here (prevents self-lockout).
  if (isSelf) {
    return <span className="text-xs text-muted-foreground">You</span>;
  }

  const promote = role !== "ADMIN";

  function toggle() {
    run(() => setUserRole(userId, promote ? "ADMIN" : "USER"), {
      failure: "Failed to update role.",
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant={promote ? "default" : "outline"}
        size="sm"
        onClick={toggle}
        disabled={pending}
      >
        {promote ? (
          <>
            <ShieldCheck className="h-4 w-4" /> Make admin
          </>
        ) : (
          <>
            <ShieldOff className="h-4 w-4" /> Revoke admin
          </>
        )}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
