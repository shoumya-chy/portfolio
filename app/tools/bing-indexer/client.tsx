"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Globe, Lock } from "lucide-react";
import { BingIndexerDashboard } from "@/components/bing-indexer/BingIndexerDashboard";

export function BingIndexerClient() {
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
        <div className="max-w-5xl mx-auto flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
        </div>
      </section>
    );
  }

  return (
    <section className="min-h-screen pt-28 pb-24 px-6">
      <div className="max-w-5xl mx-auto">
        <Link
          href="/tools"
          className="inline-flex items-center gap-1 text-sm text-[var(--color-text-dim)] hover:text-[var(--color-text-muted)] transition-colors mb-8"
        >
          &larr; All Tools
        </Link>

        <div className="flex items-center gap-3 mb-2">
          <Globe size={20} className="text-[var(--color-accent)]" />
          <p className="section-heading mb-0">Bing Indexer</p>
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
          Bing IndexNow Submitter
        </h1>
        <p className="mt-3 text-[var(--color-text-muted)] max-w-2xl mb-10">
          Auto-submit your sitemap URLs or individual pages to Bing via the IndexNow protocol.
          Indexes posts one-by-one with configurable rate limiting — ensuring every page stays
          discoverable on Bing.
        </p>

        {isAdmin ? (
          <BingIndexerDashboard />
        ) : (
          <div className="p-8 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-lg bg-[var(--color-accent-glow)]">
                <Lock size={24} className="text-[var(--color-accent)]" />
              </div>
              <div>
                <h2 className="text-lg font-semibold mb-2">Admin Access Required</h2>
                <p className="text-[var(--color-text-muted)] mb-4">
                  The Bing Indexer is an admin-only tool. It submits your pages to Bing via
                  the IndexNow protocol to ensure rapid discovery and indexing.
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
