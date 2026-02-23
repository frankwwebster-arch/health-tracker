"use client";

import Link from "next/link";
import { AccountWidget } from "@/components/AccountWidget";

export function LayoutHeader({ title }: { title: string }) {
  return (
    <header className="sticky top-0 z-10 bg-surface/98 backdrop-blur-sm border-b border-border">
      <div className="flex items-center justify-between min-h-[3.5rem] py-3 px-4 max-w-lg mx-auto gap-3">
        <h1 className="text-xl font-semibold text-gray-800 tracking-tight shrink-0">{title}</h1>
        <nav className="flex items-center gap-2 flex-wrap justify-end">
          <Link
            href="/today"
            className="px-3 py-2 rounded-lg text-muted hover:text-gray-800 hover:bg-accent-soft text-sm font-medium"
          >
            Today
          </Link>
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
