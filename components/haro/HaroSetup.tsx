"use client";

import { useState, useEffect } from "react";
import { Loader2, AlertCircle, Save } from "lucide-react";

interface Props {
  onSaved: () => void;
}

interface FormData {
  siteUrl: string;
  siteName: string;
  emailAddress: string;
  respondAsName: string;
  respondAsTitle: string;
  bio: string;
  expertiseAreas: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpPassword: string;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  imapPassword: string;
  multiNiche: boolean;
  active: boolean;
}

export function HaroSetup({ onSaved }: Props) {
  const [form, setForm] = useState<FormData>({
    siteUrl: "",
    siteName: "",
    emailAddress: "",
    respondAsName: "",
    respondAsTitle: "",
    bio: "",
    expertiseAreas: "",
    smtpHost: "smtp.hostinger.com",
    smtpPort: 587,
    smtpSecure: false,
    smtpPassword: "",
    imapHost: "imap.hostinger.com",
    imapPort: 993,
    imapSecure: true,
    imapPassword: "",
    multiNiche: false,
    active: true,
  });
  const [loading, setLoading] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    fetch("/api/tools/haro-responder/config")
      .then((r) => r.json())
      .then((d) => {
        if (d.config) {
          setForm({
            siteUrl: d.config.siteUrl || "",
            siteName: d.config.siteName || "",
            emailAddress: d.config.emailAddress || "",
            respondAsName: d.config.respondAsName || "",
            respondAsTitle: d.config.respondAsTitle || "",
            bio: d.config.bio || "",
            expertiseAreas: (d.config.expertiseAreas || []).join(", "),
            smtpHost: d.config.smtpConfig?.host || "smtp.hostinger.com",
            smtpPort: d.config.smtpConfig?.port || 587,
            smtpSecure: d.config.smtpConfig?.secure || false,
            smtpPassword: d.config.smtpConfig?.password || "",
            imapHost: d.config.imapConfig?.host || "imap.hostinger.com",
            imapPort: d.config.imapConfig?.port || 993,
            imapSecure: d.config.imapConfig?.secure !== false,
            imapPassword: d.config.imapConfig?.password || "",
            multiNiche: d.config.multiNiche || false,
            active: d.config.active !== false,
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoadingConfig(false));
  }, []);

  const handleEmailChange = (email: string) => {
    setForm((f) => ({ ...f, emailAddress: email }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/tools/haro-responder/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          expertiseAreas: form.expertiseAreas.split(",").map((s) => s.trim()).filter(Boolean),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      setSuccess("Configuration saved!");
      setTimeout(() => { setSuccess(""); onSaved(); }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-dim)] focus:outline-none focus:border-[var(--color-accent)]";

  if (loadingConfig) {
    return (
      <div className="flex items-center justify-center py-12 text-[var(--color-text-dim)]">
        <Loader2 size={20} className="animate-spin mr-2" /> Loading...
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg">
          <AlertCircle size={16} /> {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 px-4 py-3 text-sm text-green-400 bg-green-400/10 border border-green-400/20 rounded-lg">
          <Save size={16} /> {success}
        </div>
      )}

      {/* Identity */}
      <div className="p-4 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl space-y-4">
        <h3 className="text-sm font-semibold text-[var(--color-text-dim)]">Your Identity</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <input type="text" placeholder="Your full name" value={form.respondAsName} onChange={(e) => setForm({ ...form, respondAsName: e.target.value })} required className={inputClass} />
          <input type="text" placeholder="Your title (e.g., SEO Consultant)" value={form.respondAsTitle} onChange={(e) => setForm({ ...form, respondAsTitle: e.target.value })} required className={inputClass} />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <input type="url" placeholder="Site URL (e.g., https://shoumya.me)" value={form.siteUrl} onChange={(e) => setForm({ ...form, siteUrl: e.target.value })} required className={inputClass} />
          <input type="text" placeholder="Site name" value={form.siteName} onChange={(e) => setForm({ ...form, siteName: e.target.value })} required className={inputClass} />
        </div>
        <textarea placeholder="Short bio (used in responses)" value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} rows={3} className={inputClass} />
        <input type="text" placeholder="Expertise areas (comma-separated, e.g., SEO, Web Development, Digital Marketing)" value={form.expertiseAreas} onChange={(e) => setForm({ ...form, expertiseAreas: e.target.value })} className={inputClass} />
      </div>

      {/* Email */}
      <div className="p-4 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--color-text-dim)]">Email Configuration</h3>
          <span className="text-xs text-[var(--color-text-dim)]">Pre-filled for Hostinger</span>
        </div>
        <input type="email" placeholder="Email address (registered on SourceBottle/Qwoted/Featured)" value={form.emailAddress} onChange={(e) => handleEmailChange(e.target.value)} required className={inputClass} />
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <p className="text-xs font-medium text-[var(--color-text-dim)]">SMTP (Sending)</p>
            <div className="grid grid-cols-2 gap-2">
              <input type="text" placeholder="SMTP Host" value={form.smtpHost} onChange={(e) => setForm({ ...form, smtpHost: e.target.value })} className={inputClass} />
              <input type="number" placeholder="Port" value={form.smtpPort} onChange={(e) => setForm({ ...form, smtpPort: parseInt(e.target.value) || 587 })} className={inputClass} />
            </div>
            <input type="password" placeholder="SMTP Password" value={form.smtpPassword} onChange={(e) => setForm({ ...form, smtpPassword: e.target.value })} required className={inputClass} />
          </div>
          <div className="space-y-2">
            <p className="text-xs font-medium text-[var(--color-text-dim)]">IMAP (Receiving)</p>
            <div className="grid grid-cols-2 gap-2">
              <input type="text" placeholder="IMAP Host" value={form.imapHost} onChange={(e) => setForm({ ...form, imapHost: e.target.value })} className={inputClass} />
              <input type="number" placeholder="Port" value={form.imapPort} onChange={(e) => setForm({ ...form, imapPort: parseInt(e.target.value) || 993 })} className={inputClass} />
            </div>
            <input type="password" placeholder="IMAP Password" value={form.imapPassword} onChange={(e) => setForm({ ...form, imapPassword: e.target.value })} required className={inputClass} />
          </div>
        </div>
      </div>

      {/* Toggles */}
      <div className="p-4 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl space-y-4">
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={form.multiNiche} onChange={(e) => setForm({ ...form, multiNiche: e.target.checked })} className="w-4 h-4 accent-[var(--color-purple)]" />
          <div>
            <p className="text-sm font-medium">Multi-niche site</p>
            <p className="text-xs text-[var(--color-text-dim)]">AI will adapt your bio and title to match each query topic — never miss a backlink opportunity regardless of the topic</p>
          </div>
        </label>
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="w-4 h-4 accent-[var(--color-accent)]" />
          <div>
            <p className="text-sm font-medium">Auto-respond to queries</p>
            <p className="text-xs text-[var(--color-text-dim)]">When enabled, AI will automatically generate and send responses to journalist queries</p>
          </div>
        </label>
      </div>

      <button type="submit" disabled={loading} className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white rounded-lg disabled:opacity-50 transition-colors">
        {loading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
        Save Configuration
      </button>
    </form>
  );
}
