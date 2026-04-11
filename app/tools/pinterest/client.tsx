"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Image, Lock } from "lucide-react";
import { PinterestDashboard } from "@/components/pinterest/PinterestDashboard";

export function PinterestClient() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    fetch("/api/auth/verify")
      .then((r) => r.json())
      .then((d) => setIsAdmin(d.isAdmin))
      .catch(() => setIsAdmin(false))
      .finally(() => setChecking(false));
  }, []);

  if (checking) {
    return (
      <section className="min-h-screen pt-28 pb-24 px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
        </div>
      </section>
    );
  }

  return (
    <section className="min-h-screen pt-28 pb-24 px-6">
      <div className="max-w-6xl mx-auto">
        <Link
          href="/tools"
          className="inline-flex items-center gap-1 text-sm text-[var(--color-text-dim)] hover:text-[var(--color-text-muted)] transition-colors mb-8"
        >
          &larr; All Tools
        </Link>

        <div className="flex items-center gap-3 mb-2">
          <Image size={20} className="text-red-400" />
          <p className="section-heading mb-0">Pinterest Auto-Pinner</p>
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
          Automated Pinterest Strategy
        </h1>
        <p className="mt-3 text-[var(--color-text-muted)] max-w-2xl mb-10">
          Fetches your WordPress posts, scores them by keyword value, uses AI to
          write pin content and generate images, then publishes to Pinterest automatically.
        </p>

        {isAdmin ? (
          <PinterestDashboard onLogout={() => setIsAdmin(false)} />
        ) : (
          <div className="p-8 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-lg" style={{ backgroundColor: "rgba(239, 68, 68, 0.1)" }}>
                <Lock size={24} className="text-red-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold mb-2">Admin Access Required</h2>
                <p className="text-[var(--color-text-muted)] mb-4">
                  Pinterest Auto-Pinner is an admin-only tool. It connects to your WordPress
                  site and Pinterest account to publish optimised pins automatically.
                </p>
                <p className="text-sm text-[var(--color-text-dim)]">
                  Please log in with admin credentials to access this tool.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
