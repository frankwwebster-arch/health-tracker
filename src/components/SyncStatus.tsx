"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useSync } from "@/components/SyncContext";

export function SyncStatus() {
  const { user } = useAuth();
  const sync = useSync();
  const [online, setOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  useEffect(() => {
    if (online && user && sync) {
      sync.sync().then(() => sync.refreshLastSync());
    }
  }, [online, user]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!user) return null;

  return (
    <span className="text-xs text-muted">
      {online ? "Synced" : "Offline (saving locally)"}
    </span>
  );
}
