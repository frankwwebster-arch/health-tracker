"use client";

import { useEffect, useRef } from "react";

/**
 * Keeps the screen awake while `requested` is true (e.g. live workout).
 * Re-requests after tab visibility returns (Safari / mobile).
 */
export function useWakeLock(requested: boolean) {
  const lockRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (!requested || typeof navigator === "undefined" || !("wakeLock" in navigator)) {
      return;
    }

    let cancelled = false;

    const acquire = async () => {
      try {
        const lock = await navigator.wakeLock.request("screen");
        if (cancelled) {
          await lock.release().catch(() => {});
          return;
        }
        lockRef.current?.release().catch(() => {});
        lockRef.current = lock;
      } catch {
        // Unsupported, denied, or not visible
      }
    };

    void acquire();

    const onVisible = () => {
      if (document.visibilityState === "visible" && requested && !cancelled) {
        void acquire();
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      lockRef.current?.release().catch(() => {});
      lockRef.current = null;
    };
  }, [requested]);
}
