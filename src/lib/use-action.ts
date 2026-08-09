"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";

type RunOptions<T> = {
  /** Shown when the action throws something without a message of its own. */
  failure: string;
  /** Runs after a successful action, with whatever it returned. */
  onSuccess?: (result: T) => void;
  /** Runs when the action throws — for undoing an optimistic update. */
  onError?: () => void;
  /** Re-render server data afterwards. Turn off for actions that navigate away. */
  refresh?: boolean;
};

/**
 * The shape every mutating control in this app shares: run a Server Action in a
 * transition, expose a `pending` flag for disabling buttons, and surface a
 * failure as a message rather than an unhandled rejection.
 *
 * Server Actions reject with a real Error carrying the message the action chose
 * ("You own this list — delete it instead of leaving."), so that text wins;
 * `failure` is only the fallback for a throw that isn't an Error.
 *
 * Client-only — it uses hooks, so never import it from a Server Component.
 */
export function useAction() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    <T>(action: () => Promise<T>, options: RunOptions<T>) => {
      const { failure, onSuccess, onError, refresh = true } = options;
      setError(null);
      startTransition(async () => {
        try {
          const result = await action();
          onSuccess?.(result);
          if (refresh) router.refresh();
        } catch (err) {
          onError?.();
          setError(err instanceof Error ? err.message : failure);
        }
      });
    },
    [router],
  );

  return { pending, error, setError, run };
}
