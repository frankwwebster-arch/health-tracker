"use client";

import Link from "next/link";
import { LayoutHeader } from "@/components/LayoutHeader";

export default function PrivacyPage() {
  return (
    <>
      <LayoutHeader title="Privacy" />
      <main className="max-w-lg mx-auto px-4 py-6 pb-24 space-y-6">
        <div className="rounded-2xl border border-border bg-white p-5 shadow-card space-y-3">
          <p className="text-gray-800 font-medium leading-relaxed">
            Your data is stored on your device for privacy.
          </p>
          <p className="text-sm text-muted leading-relaxed">
            Personal health data is kept local to your device by default. Signing in is for your
            identity and account access—we don&apos;t use it as a reason to store readable wellness
            data in the cloud in this version of the app.
          </p>
        </div>
        <p className="text-sm text-muted">
          <Link href="/settings" className="text-accent font-medium hover:underline">
            Back to Settings
          </Link>
        </p>
      </main>
    </>
  );
}
