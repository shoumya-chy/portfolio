"use client";

import { useState, useEffect } from "react";
import { HaroDashboard } from "@/components/haro/HaroDashboard";
import { LoginModal } from "@/components/content-ideas/LoginModal";
import { Lock, LogIn } from "lucide-react";

export function HaroResponderClient() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(true);
  const [showLogin, setShowLogin] = useState(false);

  useEffect(() => {
    fetch("/api/auth/verify")
      .then((r) => r.json())
      .then((d) => setIsAdmin(d.isAdmin))
      .catch(() => setIsAdmin(false))
      .finally(() => setChecking(false));
  }, []);

  if (checking) {
    return (
      <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[var(--color-bg)]">
        <div className="mx-auto max-w-4xl pt-28 pb-16 px-4 sm:px-6">
          <h1 className="text-2xl font-bold mb-2">HARO Auto-Responder</h1>
          <p className="text-[var(--color-text-dim)] mb-8">
            Automatically respond to journalist queries from SourceBottle, Qwoted, and Featured.
          </p>
          <div className="p-8 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl text-center">
            <Lock size={32} className="mx-auto mb-4 text-[var(--color-text-dim)]" />
            <p className="text-[var(--color-text-dim)] mb-4">Admin access required to use this tool.</p>
            <button
              onClick={() => setShowLogin(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white rounded-lg text-sm font-medium transition-colors"
            >
              <LogIn size={16} /> Sign In
            </button>
          </div>
        </div>
        {showLogin && (
          <LoginModal
            onClose={() => setShowLogin(false)}
            onSuccess={() => { setShowLogin(false); setIsAdmin(true); }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <div className="mx-auto max-w-4xl pt-24 sm:pt-28 pb-16 sm:pb-24 px-4 sm:px-6">
        <h1 className="text-2xl font-bold mb-2">HARO Auto-Responder</h1>
        <p className="text-[var(--color-text-dim)] mb-8">
          AI-powered responses to journalist queries from SourceBottle, Qwoted, and Featured.
        </p>
        <HaroDashboard onLogout={() => setIsAdmin(false)} />
      </div>
    </div>
  );
}
