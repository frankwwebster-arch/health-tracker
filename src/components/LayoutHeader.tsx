"use client";

import Link from "next/link";

export function LayoutHeader({ title }: { title: string }) {
  return (
    <header className="sticky top-0 z-10 bg-surface/95 backdrop-blur border-b border-border">
      <div className="flex items-center justify-between h-14 px-4 max-w-lg mx-auto">
        <h1 className="text-lg font-medium text-gray-800">{title}</h1>
        <nav className="flex gap-2">
          <Link
            href="/today"
            className="px-3 py-2 rounded-lg text-muted hover:bg-gray-100 text-sm"
          >
            Today
          </Link>
          <Link
            href="/settings"
            className="px-3 py-2 rounded-lg text-muted hover:bg-gray-100 text-sm"
          >
            Settings
          </Link>
        </nav>
      </div>
    </header>
  );
}
