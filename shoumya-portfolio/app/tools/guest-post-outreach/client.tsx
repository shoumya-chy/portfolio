"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Zap, Lock } from "lucide-react";
import { OutreachDashboard } from "@/components/outreach/OutreachDashboard";

export function GuestPostOutreachClient() {
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
          <Zap size={20} className="text-[var(--color-accent)]" />
          <p className="section-heading mb-0">Guest Post Outreach</p>
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
          Automated Backlink Strategy
        </h1>
        <p className="mt-3 text-[var(--color-text-muted)] max-w-2xl mb-10">
          Discover relevant guest posting opportunities, automate outreach campaigns, and manage responses
          all in one place. Build high-quality backlinks at scale with intelligent prospect targeting.
        </p>

        {isAdmin ? (
          <OutreachDashboard onLogout={() => setIsAdmin(false)} />
        ) : (
          <div className="p-8 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-lg bg-[var(--color-orange)]/10">
                <Lock size={24} className="text-[var(--color-orange)]" />
              </div>
              <div>
                <h2 className="text-lg font-semibold mb-2">Admin Access Required</h2>
                <p className="text-[var(--color-text-muted)] mb-4">
                  Guest Post Outreach is an admin-only tool. This tool helps manage automated outreach campaigns,
                  track prospect responses, and generate guest post content for backlink building.
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
