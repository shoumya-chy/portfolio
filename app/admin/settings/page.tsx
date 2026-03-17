"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Settings, Loader2 } from "lucide-react";
import { SettingsForm } from "@/components/admin/SettingsForm";
import { SiteManager } from "@/components/admin/SiteManager";

export default function SettingsPage() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(true);
  const [settings, setSettings] = useState<any>(null);

  const loadSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/settings");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setSettings(data);
    } catch {
      // Settings fetch failed
    }
  }, []);

  useEffect(() => {
    fetch("/api/auth/verify")
      .then((r) => r.json())
      .then((d) => {
        setIsAdmin(d.isAdmin);
        if (!d.isAdmin) router.push("/");
      })
      .catch(() => router.push("/"))
      .finally(() => setChecking(false));
  }, [router]);

  useEffect(() => {
    if (isAdmin) loadSettings();
  }, [isAdmin, loadSettings]);

  if (checking || !isAdmin) {
    return (
      <section className="min-h-screen pt-28 pb-24 px-6">
        <div className="max-w-3xl mx-auto flex items-center justify-center py-20">
          <Loader2 size={24} className="text-[var(--color-accent)] animate-spin" />
        </div>
      </section>
    );
  }

  return (
    <section className="min-h-screen pt-28 pb-24 px-6">
      <div className="max-w-3xl mx-auto">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-[var(--color-text-dim)] hover:text-[var(--color-text-muted)] transition-colors mb-8"
        >
          &larr; Home
        </Link>

        <div className="flex items-center gap-3 mb-2">
          <Settings size={20} className="text-[var(--color-accent)]" />
          <p className="section-heading mb-0">Admin</p>
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
          Settings
        </h1>
        <p className="mt-3 text-[var(--color-text-muted)] max-w-2xl mb-10">
          Manage API keys, tracked sites, and security settings.
        </p>

        {settings ? (
          <div className="space-y-6">
            <SiteManager sites={settings.sites} onUpdated={loadSettings} />
            <SettingsForm settings={settings} onSaved={loadSettings} />
          </div>
        ) : (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={20} className="text-[var(--color-text-dim)] animate-spin" />
          </div>
        )}
      </div>
    </section>
  );
}
