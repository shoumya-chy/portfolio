"use client";

import { useState } from "react";
import { X, Loader2, AlertCircle } from "lucide-react";

interface EditProject {
  id: string;
  name: string;
  senderName?: string;
  niche: string;
  emailAddress: string;
  domainFilters: string[];
  emailsPerWeek: number;
  emailsPerDay?: number;
  followUpDays?: number;
  maxFollowUps?: number;
  smtpConfig: { host: string; port: number; secure: boolean; username: string; password: string };
  imapConfig: { host: string; port: number; secure: boolean; username: string; password: string };
}

interface Props {
  onClose: () => void;
  onCreated: () => void;
  editProject?: EditProject;
}

interface FormData {
  name: string;
  senderName: string;
  niche: string;
  emailAddress: string;
  domainFilters: string;
  emailsPerWeek: number;
  emailsPerDay: number;
  followUpDays: number;
  maxFollowUps: number;
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

export function ProjectManager({ onClose, onCreated, editProject }: Props) {
  const isEdit = !!editProject;
  const [formData, setFormData] = useState<FormData>({
    name: editProject?.name || "",
    senderName: editProject?.senderName || editProject?.name || "",
    niche: editProject?.niche || "",
    emailAddress: editProject?.emailAddress || "",
    domainFilters: editProject?.domainFilters?.join(", ") || "",
    emailsPerWeek: editProject?.emailsPerWeek || 140,
    emailsPerDay: editProject?.emailsPerDay || 20,
    followUpDays: editProject?.followUpDays || 5,
    maxFollowUps: editProject?.maxFollowUps || 2,
    smtp: editProject?.smtpConfig || {
      host: "smtp.hostinger.com",
      port: 587,
      secure: false,
      username: "",
      password: "",
    },
    imap: editProject?.imapConfig || {
      host: "imap.hostinger.com",
      port: 993,
      secure: true,
      username: "",
      password: "",
    },
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Auto-fill SMTP/IMAP username when email changes
  const handleEmailChange = (email: string) => {
    setFormData({
      ...formData,
      emailAddress: email,
      smtp: { ...formData.smtp, username: email },
      imap: { ...formData.imap, username: email },
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const payload = {
        name: formData.name,
        senderName: formData.senderName || formData.name,
        niche: formData.niche || "",
        emailAddress: formData.emailAddress,
        domainFilters: formData.domainFilters.split(",").map((f) => f.trim()).filter(Boolean),
        emailsPerWeek: formData.emailsPerWeek,
        emailsPerDay: formData.emailsPerDay,
        followUpDays: formData.followUpDays,
        maxFollowUps: formData.maxFollowUps,
        smtpConfig: formData.smtp,
        imapConfig: formData.imap,
      };

      const res = await fetch("/api/tools/guest-post-outreach/projects", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isEdit ? { ...payload, id: editProject?.id } : payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Failed to ${isEdit ? "update" : "create"} project (${res.status})`);
      }

      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project");
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-dim)] focus:outline-none focus:border-[var(--color-accent)]";

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 flex items-center justify-between p-6 border-b border-[var(--color-border)] bg-[var(--color-bg-card)]">
          <h2 className="text-lg font-semibold">{isEdit ? "Edit Project" : "Create New Project"}</h2>
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
                className={inputClass}
              />
              <div>
                <input
                  type="text"
                  placeholder="Your name (shown in emails, e.g. Shoumya Chowdhury)"
                  value={formData.senderName}
                  onChange={(e) => setFormData({ ...formData, senderName: e.target.value })}
                  required
                  className={inputClass}
                />
                <p className="mt-1 text-xs text-[var(--color-text-dim)]">
                  This name appears in the &quot;From&quot; field of outreach emails
                </p>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <input
                  type="text"
                  placeholder="Niche (leave empty for multi-niche)"
                  value={formData.niche}
                  onChange={(e) => setFormData({ ...formData, niche: e.target.value })}
                  className={inputClass}
                />
                <p className="mt-1 text-xs text-[var(--color-text-dim)]">
                  Empty = multi-niche (searches across all topics)
                </p>
              </div>
              <input
                type="email"
                placeholder="Email address (e.g., outreach@yourdomain.com)"
                value={formData.emailAddress}
                onChange={(e) => handleEmailChange(e.target.value)}
                required
                className={inputClass}
              />
            </div>
            <div className="grid sm:grid-cols-4 gap-4">
              <div>
                <input
                  type="number"
                  placeholder="Emails/day"
                  value={formData.emailsPerDay}
                  onChange={(e) => setFormData({ ...formData, emailsPerDay: parseInt(e.target.value) || 20 })}
                  min="1"
                  max="50"
                  className={inputClass}
                />
                <p className="mt-1 text-xs text-[var(--color-text-dim)]">Per day</p>
              </div>
              <div>
                <input
                  type="number"
                  placeholder="Emails/week"
                  value={formData.emailsPerWeek}
                  onChange={(e) => setFormData({ ...formData, emailsPerWeek: parseInt(e.target.value) || 140 })}
                  min="1"
                  className={inputClass}
                />
                <p className="mt-1 text-xs text-[var(--color-text-dim)]">Per week</p>
              </div>
              <div>
                <input
                  type="number"
                  placeholder="Follow-up days"
                  value={formData.followUpDays}
                  onChange={(e) => setFormData({ ...formData, followUpDays: parseInt(e.target.value) || 5 })}
                  min="2"
                  max="14"
                  className={inputClass}
                />
                <p className="mt-1 text-xs text-[var(--color-text-dim)]">Days before follow-up</p>
              </div>
              <div>
                <input
                  type="number"
                  placeholder="Max follow-ups"
                  value={formData.maxFollowUps}
                  onChange={(e) => setFormData({ ...formData, maxFollowUps: parseInt(e.target.value) || 2 })}
                  min="0"
                  max="5"
                  className={inputClass}
                />
                <p className="mt-1 text-xs text-[var(--color-text-dim)]">Follow-ups per prospect</p>
              </div>
            </div>
            <input
              type="text"
              placeholder="Domain filters (comma-separated, e.g. .com, .org, .io)"
              value={formData.domainFilters}
              onChange={(e) => setFormData({ ...formData, domainFilters: e.target.value })}
              className={inputClass}
            />
          </div>

          {/* SMTP Configuration */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[var(--color-text-dim)]">SMTP Configuration (Sending)</h3>
              <span className="text-xs text-[var(--color-text-dim)]">Pre-filled for Hostinger</span>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="SMTP Host"
                value={formData.smtp.host}
                onChange={(e) => setFormData({ ...formData, smtp: { ...formData.smtp, host: e.target.value } })}
                required
                className={inputClass}
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  placeholder="Port"
                  value={formData.smtp.port}
                  onChange={(e) => setFormData({ ...formData, smtp: { ...formData.smtp, port: parseInt(e.target.value) || 587 } })}
                  min="1"
                  className={inputClass}
                />
                <label className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--color-text)]">
                  <input
                    type="checkbox"
                    checked={formData.smtp.secure}
                    onChange={(e) => setFormData({ ...formData, smtp: { ...formData.smtp, secure: e.target.checked } })}
                    className="w-4 h-4"
                  />
                  SSL/TLS
                </label>
              </div>
            </div>
            <p className="text-xs text-[var(--color-text-dim)]">
              Port 587 uses STARTTLS (recommended for Hostinger). Port 465 uses direct SSL.
            </p>
            <div className="grid sm:grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="SMTP Username (your email)"
                value={formData.smtp.username}
                onChange={(e) => setFormData({ ...formData, smtp: { ...formData.smtp, username: e.target.value } })}
                required
                className={inputClass}
              />
              <input
                type="password"
                placeholder="SMTP Password"
                value={formData.smtp.password}
                onChange={(e) => setFormData({ ...formData, smtp: { ...formData.smtp, password: e.target.value } })}
                required
                className={inputClass}
              />
            </div>
          </div>

          {/* IMAP Configuration */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[var(--color-text-dim)]">IMAP Configuration (Receiving)</h3>
              <span className="text-xs text-[var(--color-text-dim)]">Pre-filled for Hostinger</span>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="IMAP Host"
                value={formData.imap.host}
                onChange={(e) => setFormData({ ...formData, imap: { ...formData.imap, host: e.target.value } })}
                required
                className={inputClass}
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  placeholder="Port"
                  value={formData.imap.port}
                  onChange={(e) => setFormData({ ...formData, imap: { ...formData.imap, port: parseInt(e.target.value) || 993 } })}
                  min="1"
                  className={inputClass}
                />
                <label className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--color-text)]">
                  <input
                    type="checkbox"
                    checked={formData.imap.secure}
                    onChange={(e) => setFormData({ ...formData, imap: { ...formData.imap, secure: e.target.checked } })}
                    className="w-4 h-4"
                  />
                  SSL/TLS
                </label>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="IMAP Username (your email)"
                value={formData.imap.username}
                onChange={(e) => setFormData({ ...formData, imap: { ...formData.imap, username: e.target.value } })}
                required
                className={inputClass}
              />
              <input
                type="password"
                placeholder="IMAP Password"
                value={formData.imap.password}
                onChange={(e) => setFormData({ ...formData, imap: { ...formData.imap, password: e.target.value } })}
                required
                className={inputClass}
              />
            </div>
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
              {isEdit ? "Save Changes" : "Create Project"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
