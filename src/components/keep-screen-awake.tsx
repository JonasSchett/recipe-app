"use client";

import { useEffect } from "react";

/**
 * Keeps the device screen on while mounted (e.g. cooking from a phone),
 * using the Screen Wake Lock API. The lock is released automatically when
 * the tab is hidden, so we re-acquire it on return. Renders nothing and
 * no-ops silently where the API is unavailable (it needs HTTPS/localhost).
 */
export function KeepScreenAwake() {
  useEffect(() => {
    if (!("wakeLock" in navigator)) return;

    let lock: WakeLockSentinel | null = null;
    let unmounted = false;

    async function acquire() {
      try {
        lock = await navigator.wakeLock.request("screen");
        // The component may have unmounted while the request was in flight.
        if (unmounted) await lock.release();
      } catch {
        // Denied (e.g. battery saver) — the page still works, it just dims.
      }
    }

    function onVisibilityChange() {
      if (document.visibilityState === "visible") acquire();
    }

    acquire();
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      unmounted = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      lock?.release().catch(() => {});
    };
  }, []);

  return null;
}
