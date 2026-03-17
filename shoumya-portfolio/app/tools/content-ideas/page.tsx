"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { AdminDashboard } from "@/components/content-ideas/AdminDashboard";
import { VisitorOverview } from "@/components/content-ideas/VisitorOverview";
import { LoginModal } from "@/components/content-ideas/LoginModal";

export default function ContentIdeasPage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
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
          <Sparkles size={20} className="text-[var(--color-accent)]" />
          <p className="section-heading mb-0">Content Ideas Generator</p>
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
          AI-Powered Content Intelligence
        </h1>
        <p className="mt-3 text-[var(--color-text-muted)] max-w-2xl mb-10">
          Aggregates data from Google Search Console, Bing Webmaster Tools, and Reddit,
          then uses Claude AI to generate strategic content ideas and identify opportunities.
        </p>

        {isAdmin ? (
          <AdminDashboard onLogout={() => setIsAdmin(false)} />
        ) : (
          <VisitorOverview onLoginClick={() => setShowLogin(true)} />
        )}

        {showLogin && (
          <LoginModal
            onSuccess={() => {
              setShowLogin(false);
              setIsAdmin(true);
            }}
            onClose={() => setShowLogin(false)}
          />
        )}
      </div>
    </section>
  );
}
