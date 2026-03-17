"use client";

import { useState } from "react";
import { X, Loader2, AlertCircle } from "lucide-react";
import type { OutreachProject } from "@/lib/outreach/types";

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

interface FormData {
  name: string;
  niche: string;
  emailAddress: string;
  domainFilters: string;
  emailsPerWeek: number;
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    username: string;
    password: string;
  };
  imap: {
    host: string;
    port: number;
    secure: boolean;
    username: string;
    password: string;
  };
}

export function ProjectManager({ onClose, onCreated }: Props) {
  const [formData, setFormData] = useState<FormData>({
    name: "",
    niche: "",
    emailAddress: "",
    domainFilters: "",
    emailsPerWeek: 20,
    smtp: {
      host: "",
      port: 465,
      secure: true,
      username: "",
      password: "",
    },
    imap: {
      host: "",
      port: 993,
      secure: true,
      username: "",
      password: "",
    },
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const payload = {
        name: formData.name,
        niche: formData.niche,
        emailAddress: formData.emailAddress,
        domainFilters: formData.domainFilters.split(",").map((f) => f.trim()).filter(Boolean),
        emailsPerWeek: formData.emailsPerWeek,
        smtpConfig: formData.smtp,
        imapConfig: formData.imap,
      };

      const res = await fetch("/api/tools/guest-post-outreach/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`Failed to create project (${res.status})`);
      }

      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 flex items-center justify-between p-6 border-b border-[var(--color-border)] bg-[var(--color-bg-card)]">
          <h2 className="text-lg font-semibold">Create New Project</h2>
          <button
            onClick={onClose}
            className="p-1 text-[var(--color-text-dim)] hover:text-[var(--color-text)] transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="flex items-center gap-2 px-4 py-3 text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          {/* Basic Info */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-[var(--color-text-dim)]">Project Details</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="Project name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-dim)] focus:outline-none focus:border-[var(--color-accent)]"
              />
              <input
                type="text"
                placeholder="Niche (e.g., SaaS, Tech)"
                value={formData.niche}
                onChange={(e) => setFormData({ ...formData, niche: e.target.value })}
                required
                className="px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-dim)] focus:outline-none focus:border-[var(--color-accent)]"
              />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <input
                type="email"
                placeholder="Email address"
                value={formData.emailAddress}
                onChange={(e) => setFormData({ ...formData, emailAddress: e.target.value })}
                required
                className="px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-dim)] focus:outline-none focus:border-[var(--color-accent)]"
              />
              <input
                type="number"
                placeholder="Emails per week"
                value={formData.emailsPerWeek}
                onChange={(e) => setFormData({ ...formData, emailsPerWeek: parseInt(e.target.value) || 20 })}
                min="1"
                className="px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-dim)] focus:outline-none focus:border-[var(--color-accent)]"
              />
            </div>
            <input
              type="text"
              placeholder="Domain filters (comma-separated, e.g. .com, .org, .io)"
              value={formData.domainFilters}
              onChange={(e) => setFormData({ ...formData, domainFilters: e.target.value })}
              className="w-full px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-dim)] focus:outline-none focus:border-[var(--color-accent)]"
            />
          </div>

          {/* SMTP Configuration */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-[var(--color-text-dim)]">SMTP Configuration</h3>
            <input
              type="text"
              placeholder="SMTP Host (e.g., smtp.gmail.com)"
              value={formData.smtp.host}
              onChange={(e) => setFormData({ ...formData, smtp: { ...formData.smtp, host: e.target.value } })}
              required
              className="w-full px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-dim)] focus:outline-none focus:border-[var(--color-accent)]"
            />
            <div className="grid sm:grid-cols-2 gap-4">
              <input
                type="number"
                placeholder="Port"
                value={formData.smtp.port}
                onChange={(e) => setFormData({ ...formData, smtp: { ...formData.smtp, port: parseInt(e.target.value) || 465 } })}
                min="1"
                className="px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-dim)] focus:outline-none focus:border-[var(--color-accent)]"
              />
              <label className="flex items-center gap-2 px-3 py-2">
                <input
                  type="checkbox"
                  checked={formData.smtp.secure}
                  onChange={(e) => setFormData({ ...formData, smtp: { ...formData.smtp, secure: e.target.checked } })}
                  className="w-4 h-4"
                />
                <span className="text-sm text-[var(--color-text)]">Use TLS/SSL</span>
              </label>
            </div>
            <input
              type="text"
              placeholder="SMTP Username"
              value={formData.smtp.username}
              onChange={(e) => setFormData({ ...formData, smtp: { ...formData.smtp, username: e.target.value } })}
              required
              className="w-full px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-dim)] focus:outline-none focus:border-[var(--color-accent)]"
            />
            <input
              type="password"
              placeholder="SMTP Password"
              value={formData.smtp.password}
              onChange={(e) => setFormData({ ...formData, smtp: { ...formData.smtp, password: e.target.value } })}
              required
              className="w-full px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-dim)] focus:outline-none focus:border-[var(--color-accent)]"
            />
          </div>

          {/* IMAP Configuration */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-[var(--color-text-dim)]">IMAP Configuration</h3>
            <input
              type="text"
              placeholder="IMAP Host (e.g., imap.gmail.com)"
              value={formData.imap.host}
              onChange={(e) => setFormData({ ...formData, imap: { ...formData.imap, host: e.target.value } })}
              required
              className="w-full px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-dim)] focus:outline-none focus:border-[var(--color-accent)]"
            />
            <div className="grid sm:grid-cols-2 gap-4">
              <input
                type="number"
                placeholder="Port"
                value={formData.imap.port}
                onChange={(e) => setFormData({ ...formData, imap: { ...formData.imap, port: parseInt(e.target.value) || 993 } })}
                min="1"
                className="px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-dim)] focus:outline-none focus:border-[var(--color-accent)]"
              />
              <label className="flex items-center gap-2 px-3 py-2">
                <input
                  type="checkbox"
                  checked={formData.imap.secure}
                  onChange={(e) => setFormData({ ...formData, imap: { ...formData.imap, secure: e.target.checked } })}
                  className="w-4 h-4"
                />
                <span className="text-sm text-[var(--color-text)]">Use TLS/SSL</span>
              </label>
            </div>
            <input
              type="text"
              placeholder="IMAP Username"
              value={formData.imap.username}
              onChange={(e) => setFormData({ ...formData, imap: { ...formData.imap, username: e.target.value } })}
              required
              className="w-full px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-dim)] focus:outline-none focus:border-[var(--color-accent)]"
            />
            <input
              type="password"
              placeholder="IMAP Password"
              value={formData.imap.password}
              onChange={(e) => setFormData({ ...formData, imap: { ...formData.imap, password: e.target.value } })}
              required
              className="w-full px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-dim)] focus:outline-none focus:border-[var(--color-accent)]"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-4 border-t border-[var(--color-border)]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-bg)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white rounded-lg disabled:opacity-50 transition-colors"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : null}
              Create Project
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
