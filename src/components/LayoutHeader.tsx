"use client";

import Link from "next/link";
import { AccountWidget } from "@/components/AccountWidget";
import { ModuleGate } from "@/components/shell/ModuleGate";

export function LayoutHeader({ title }: { title: string }) {
  return (
    <header className="sticky top-0 z-50 bg-surface/98 backdrop-blur-sm border-b border-border">
      <div className="flex items-center justify-between min-h-[3.5rem] py-3 px-4 max-w-lg mx-auto gap-3">
        <h1 className="text-xl font-semibold text-gray-800 tracking-tight shrink-0">{title}</h1>
        <nav className="flex items-center gap-2 flex-wrap justify-end">
          <Link
            href="/today"
            className="px-3 py-2 rounded-lg text-muted hover:text-gray-800 hover:bg-accent-soft text-sm font-medium"
          >
            Today
          </Link>
          <ModuleGate moduleId="workout_coach">
            <Link
              href="/coach"
              className="px-3 py-2 rounded-lg text-muted hover:text-gray-800 hover:bg-accent-soft text-sm font-medium"
            >
              Coach
            </Link>
          </ModuleGate>
          <Link
            href="/dashboard"
            className="px-3 py-2 rounded-lg text-muted hover:text-gray-800 hover:bg-accent-soft text-sm font-medium"
          >
            Dashboard
          </Link>
          <Link
            href="/settings"
            className="px-3 py-2 rounded-lg text-muted hover:text-gray-800 hover:bg-accent-soft text-sm font-medium"
          >
            Settings
          </Link>
          <AccountWidget />
        </nav>
      </div>
    </header>
  );
}
