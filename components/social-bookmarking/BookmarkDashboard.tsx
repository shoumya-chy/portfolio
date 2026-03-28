"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  RefreshCw, LogOut, Loader2, AlertCircle, Plus, Trash2,
  Bookmark, Send, CheckCircle2, XCircle, Clock,
  X, ExternalLink, FolderOpen, Pause, Settings, Key, Eye, EyeOff,
  FileText, Download,
} from "lucide-react";
import type {
  BookmarkSite, BookmarkPost, BookmarkSubmission, BookmarkStats,
  BookmarkPlatform, BookmarkJob,
} from "@/lib/social-bookmarking/types";

interface Props {
  onLogout: () => void;
}

type Tab = "sites" | "posts" | "submissions" | "platforms" | "settings";

const safeJson = async (res: Response) => {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      `Server error (${res.status}): ${text.substring(0, 100).replace(/<[^>]+>/g, "").trim() || "Internal server error"}`,
    );
  }
};

// ============ Add Site Modal ============

function AddSiteModal({
  onClose,
  onSave,
  editing,
}: {
  onClose: () => void;
  onSave: (site: Partial<BookmarkSite>) => Promise<void>;
  editing?: BookmarkSite | null;
}) {
  const [form, setForm] = useState({
    url: editing?.url || "",
    name: editing?.name || "",
    description: editing?.description || "",
    keywords: editing?.keywords?.join(", ") || "",
    sitemapUrl: editing?.sitemapUrl || "",
    rssUrl: editing?.rssUrl || "",
    contactEmail: editing?.contactEmail || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    if (!form.url || !form.name) {
      setError("URL and name are required");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave({
        ...form,
        keywords: form.keywords.split(",").map((k) => k.trim()).filter(Boolean),
        ...(editing ? { id: editing.id } : {}),
      });
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const set = (key: string, val: string) => setForm((p) => ({ ...p, [key]: val }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto p-6 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl animate-fade-up">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold">{editing ? "Edit Site" : "Add Site"}</h3>
          <button onClick={onClose} className="p-1.5 text-[var(--color-text-dim)] hover:text-[var(--color-text)] transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-[var(--color-text-dim)] mb-1 block">Website URL *</label>
            <input value={form.url} onChange={(e) => set("url", e.target.value)} placeholder="https://example.com" className="w-full px-3 py-2.5 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-dim)] focus:outline-none focus:border-[var(--color-accent)]" />
          </div>
          <div>
            <label className="text-xs text-[var(--color-text-dim)] mb-1 block">Site Name *</label>
            <input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="My Website" className="w-full px-3 py-2.5 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-dim)] focus:outline-none focus:border-[var(--color-accent)]" />
          </div>
          <div>
            <label className="text-xs text-[var(--color-text-dim)] mb-1 block">Description</label>
            <textarea value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Brief description..." rows={2} className="w-full px-3 py-2.5 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-dim)] focus:outline-none focus:border-[var(--color-accent)] resize-none" />
          </div>
          <div>
            <label className="text-xs text-[var(--color-text-dim)] mb-1 block">Keywords (comma-separated)</label>
            <input value={form.keywords} onChange={(e) => set("keywords", e.target.value)} placeholder="seo, marketing, tools" className="w-full px-3 py-2.5 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-dim)] focus:outline-none focus:border-[var(--color-accent)]" />
          </div>
          <div>
            <label className="text-xs text-[var(--color-text-dim)] mb-1 block">Contact Email</label>
            <input value={form.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} type="email" className="w-full px-3 py-2.5 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]" />
          </div>
          <div className="border-t border-[var(--color-border)] pt-3 mt-2">
            <p className="text-xs text-[var(--color-text-dim)] mb-2">Leave blank to auto-discover from your site:</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[var(--color-text-dim)] mb-1 block">Sitemap URL</label>
              <input value={form.sitemapUrl} onChange={(e) => set("sitemapUrl", e.target.value)} placeholder="Auto-discover" className="w-full px-3 py-2.5 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-dim)] focus:outline-none focus:border-[var(--color-accent)]" />
            </div>
            <div>
              <label className="text-xs text-[var(--color-text-dim)] mb-1 block">RSS Feed URL</label>
              <input value={form.rssUrl} onChange={(e) => set("rssUrl", e.target.value)} placeholder="Auto-discover" className="w-full px-3 py-2.5 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-dim)] focus:outline-none focus:border-[var(--color-accent)]" />
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-400 flex items-center gap-1"><AlertCircle size={12} /> {error}</p>
          )}

          <div className="flex gap-2 pt-2">
            <button onClick={onClose} className="flex-1 py-2.5 text-sm border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-bg)] transition-colors">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 text-sm font-semibold bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white rounded-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2">
              {saving ? <><Loader2 size={14} className="animate-spin" /> Saving...</> : editing ? "Update" : "Add Site"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ Main Dashboard ============

export function BookmarkDashboard({ onLogout }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("sites");
  const [sites, setSites] = useState<BookmarkSite[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState("");
  const [posts, setPosts] = useState<BookmarkPost[]>([]);
  const [selectedPostIds, setSelectedPostIds] = useState<Set<string>>(new Set());
  const [submissions, setSubmissions] = useState<BookmarkSubmission[]>([]);
  const [platforms, setPlatforms] = useState<BookmarkPlatform[]>([]);
  const [platStats, setPlatStats] = useState<Record<string, number>>({});
  const [stats, setStats] = useState<BookmarkStats | null>(null);
  const [job, setJob] = useState<BookmarkJob | null>(null);
  const [showAddSite, setShowAddSite] = useState(false);
  const [editingSite, setEditingSite] = useState<BookmarkSite | null>(null);
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [successMsg, setSuccessMsg] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [captchaSettings, setCaptchaSettings] = useState({ twoCaptchaApiKey: "", solveCaptchas: false, hasApiKey: false, maxPerDay: 5, delayBetweenMs: 3000 });
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);

  const setLoadingKey = (key: string, val: boolean) => setLoading((p) => ({ ...p, [key]: val }));
  const setErrorKey = (key: string, val: string) => setErrors((p) => ({ ...p, [key]: val }));

  // ========== Data Fetching ==========

  const fetchSites = useCallback(async () => {
    try {
      const d = await fetch("/api/tools/social-bookmarking/sites").then(safeJson);
      setSites(d.sites || []);
      if (d.sites?.length > 0 && !selectedSiteId) setSelectedSiteId(d.sites[0].id);
    } catch { setSites([]); }
  }, [selectedSiteId]);

  const fetchPosts = useCallback(async () => {
    if (!selectedSiteId) return;
    try {
      const d = await fetch(`/api/tools/social-bookmarking/posts?siteId=${selectedSiteId}`).then(safeJson);
      setPosts(d.posts || []);
    } catch { /* silent */ }
  }, [selectedSiteId]);

  const fetchSubmissions = useCallback(async () => {
    if (!selectedSiteId) return;
    try {
      const d = await fetch(`/api/tools/social-bookmarking/submissions?siteId=${selectedSiteId}`).then(safeJson);
      setSubmissions(d.submissions || []);
      setStats(d.stats || null);
    } catch { /* silent */ }
  }, [selectedSiteId]);

  const fetchPlatforms = useCallback(async () => {
    try {
      const d = await fetch("/api/tools/social-bookmarking/bookmarks").then(safeJson);
      setPlatforms(d.platforms || []);
      setPlatStats(d.byType || {});
    } catch { /* silent */ }
  }, []);

  const fetchJobStatus = useCallback(async () => {
    try {
      const d = await fetch("/api/tools/social-bookmarking/job-status").then(safeJson);
      setJob(d.job || null);
      return d.job;
    } catch { return null; }
  }, []);

  const fetchSettings = useCallback(async () => {
    try {
      const d = await fetch("/api/tools/social-bookmarking/settings").then(safeJson);
      setCaptchaSettings(d.settings || {});
    } catch { /* silent */ }
  }, []);

  // ========== Initial Load ==========

  useEffect(() => {
    fetchSites();
    fetchPlatforms();
    fetchSettings();
  }, [fetchSites, fetchPlatforms, fetchSettings]);

  useEffect(() => {
    if (selectedSiteId) {
      fetchPosts();
      fetchSubmissions();
      fetchJobStatus();
    }
  }, [selectedSiteId, fetchPosts, fetchSubmissions, fetchJobStatus]);

  // ========== Job Polling ==========

  useEffect(() => {
    if (job?.status === "running") {
      pollRef.current = setInterval(async () => {
        const j = await fetchJobStatus();
        if (j?.status !== "running") {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          fetchSubmissions();
        }
      }, 3000);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [job?.status, fetchJobStatus, fetchSubmissions]);

  // ========== Actions ==========

  const handleSaveSite = async (siteData: Partial<BookmarkSite>) => {
    const isUpdate = !!siteData.id;
    const res = await fetch("/api/tools/social-bookmarking/sites", {
      method: isUpdate ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(siteData),
    });
    const d = await safeJson(res);
    if (!res.ok) throw new Error(d.error || "Failed to save");
    await fetchSites();
    if (d.site?.id) setSelectedSiteId(d.site.id);
    setSuccessMsg(isUpdate ? "Site updated" : "Site added!");
    setTimeout(() => setSuccessMsg(""), 3000);
  };

  const handleDeleteSite = async (siteId: string) => {
    if (!confirm("Delete this site and all its posts/submissions?")) return;
    setLoadingKey("delete", true);
    try {
      await fetch(`/api/tools/social-bookmarking/sites?id=${siteId}`, { method: "DELETE" });
      setSites((prev) => prev.filter((s) => s.id !== siteId));
      if (selectedSiteId === siteId) setSelectedSiteId(sites.find((s) => s.id !== siteId)?.id || "");
      setPosts([]);
      setSubmissions([]);
      setSuccessMsg("Site deleted");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err: unknown) {
      setErrorKey("delete", err instanceof Error ? err.message : "Delete failed");
    } finally {
      setLoadingKey("delete", false);
    }
  };

  const handleFetchPosts = async () => {
    if (!selectedSiteId) return;
    setLoadingKey("fetch", true);
    setErrorKey("fetch", "");
    try {
      const res = await fetch("/api/tools/social-bookmarking/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId: selectedSiteId }),
      });
      const d = await safeJson(res);
      if (!res.ok) throw new Error(d.error);
      setPosts(d.posts || []);
      setSuccessMsg(d.newCount > 0 ? `Found ${d.newCount} new post(s)!` : d.message || "No new posts found");
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err: unknown) {
      setErrorKey("fetch", err instanceof Error ? err.message : "Fetch failed");
    } finally {
      setLoadingKey("fetch", false);
    }
  };

  const handleStartSubmission = async (mode: "new" | "retry-failed" | "retry-skipped" | "retry-both" = "new") => {
    if (!selectedSiteId) return;
    setLoadingKey("submit", true);
    setErrorKey("submit", "");
    try {
      const body: Record<string, unknown> = { siteId: selectedSiteId, mode };
      if (selectedPostIds.size > 0) {
        body.postIds = Array.from(selectedPostIds);
      }
      const res = await fetch("/api/tools/social-bookmarking/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await safeJson(res);
      if (!res.ok) throw new Error(d.error);
      await fetchJobStatus();
      const labels: Record<string, string> = {
        new: "Bookmark job started!",
        "retry-failed": "Retrying failed submissions...",
        "retry-skipped": "Retrying skipped submissions...",
        "retry-both": "Retrying failed & skipped...",
      };
      setSuccessMsg(labels[mode] || "Job started!");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err: unknown) {
      setErrorKey("submit", err instanceof Error ? err.message : "Failed to start");
    } finally {
      setLoadingKey("submit", false);
    }
  };

  const handleCancelJob = async () => {
    try {
      await fetch("/api/tools/social-bookmarking/job-status", { method: "DELETE" });
      await fetchJobStatus();
    } catch { /* silent */ }
  };

  const handleSaveSettings = async () => {
    setLoadingKey("settings", true);
    setErrorKey("settings", "");
    try {
      const body: Record<string, unknown> = {
        solveCaptchas: captchaSettings.solveCaptchas,
        maxPerDay: captchaSettings.maxPerDay,
        delayBetweenMs: captchaSettings.delayBetweenMs,
      };
      if (apiKeyInput && !apiKeyInput.includes("*")) body.twoCaptchaApiKey = apiKeyInput;
      const res = await fetch("/api/tools/social-bookmarking/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed to save settings");
      await fetchSettings();
      setApiKeyInput("");
      setSuccessMsg("Settings saved!");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err: unknown) {
      setErrorKey("settings", err instanceof Error ? err.message : "Save failed");
    } finally {
      setLoadingKey("settings", false);
    }
  };

  const togglePostSelection = (postId: string) => {
    setSelectedPostIds((prev) => {
      const next = new Set(prev);
      if (next.has(postId)) next.delete(postId);
      else next.add(postId);
      return next;
    });
  };

  const toggleAllPosts = () => {
    if (selectedPostIds.size === posts.length) {
      setSelectedPostIds(new Set());
    } else {
      setSelectedPostIds(new Set(posts.map((p) => p.id)));
    }
  };

  // ========== Status Badge ==========

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      submitted: "text-blue-400 border-blue-400/30 bg-blue-400/10",
      confirmed: "text-green-400 border-green-400/30 bg-green-400/10",
      failed: "text-red-400 border-red-400/30 bg-red-400/10",
      pending: "text-yellow-400 border-yellow-400/30 bg-yellow-400/10",
      skipped: "text-[var(--color-text-dim)] border-[var(--color-border)] bg-[var(--color-bg)]",
      submitting: "text-blue-400 border-blue-400/30 bg-blue-400/10",
    };
    return (
      <span className={`inline-flex items-center text-[10px] font-mono px-1.5 py-0.5 rounded border ${colors[status] || colors.pending}`}>
        {status}
      </span>
    );
  };

  // ========== Render ==========

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => setShowAddSite(true)} className="px-4 py-2 text-sm font-medium bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white rounded-lg transition-all flex items-center gap-2">
            <Plus size={14} /> Add Site
          </button>
          {sites.length > 0 && (
            <select value={selectedSiteId} onChange={(e) => setSelectedSiteId(e.target.value)} className="px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]">
              {sites.map((s) => <option key={s.id} value={s.id}>{s.name} — {s.url}</option>)}
            </select>
          )}
        </div>
        <button onClick={onLogout} className="px-3 py-2 text-sm text-[var(--color-text-dim)] hover:text-[var(--color-text)] transition-colors flex items-center gap-1">
          <LogOut size={14} /> Logout
        </button>
      </div>

      {/* Success / Error Messages */}
      {successMsg && (
        <div className="px-4 py-2.5 bg-green-500/10 border border-green-500/30 text-green-400 rounded-lg text-sm flex items-center gap-2">
          <CheckCircle2 size={14} /> {successMsg}
        </div>
      )}

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          {[
            { label: "Posts", value: stats.totalPosts, icon: FileText, color: "var(--color-accent)" },
            { label: "Platforms", value: stats.totalPlatforms, icon: FolderOpen, color: "var(--color-purple)" },
            { label: "Submitted", value: stats.submitted, icon: Send, color: "var(--color-green)" },
            { label: "Failed", value: stats.failed, icon: XCircle, color: "#ef4444" },
            { label: "Pending", value: stats.pending, icon: Clock, color: "var(--color-orange)" },
            { label: "Skipped", value: stats.skipped, icon: Pause, color: "var(--color-text-dim)" },
          ].map((card) => (
            <div key={card.label} className="p-4 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl">
              <div className="flex items-center gap-2 mb-1">
                <card.icon size={14} style={{ color: card.color }} />
                <span className="text-xs text-[var(--color-text-dim)]">{card.label}</span>
              </div>
              <p className="text-2xl font-bold" style={{ color: card.color }}>{card.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Job Progress */}
      {job?.status === "running" && (
        <div className="p-4 bg-[var(--color-bg-card)] border border-[var(--color-accent)]/30 rounded-xl">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Loader2 size={16} className="animate-spin text-[var(--color-accent)]" />
              <span className="text-sm font-medium">Submitting bookmarks...</span>
            </div>
            <button onClick={handleCancelJob} className="text-xs text-red-400 hover:text-red-300 transition-colors">Cancel</button>
          </div>
          <div className="w-full h-2 bg-[var(--color-bg)] rounded-full overflow-hidden mb-2">
            <div className="h-full bg-[var(--color-accent)] rounded-full transition-all duration-500" style={{ width: `${job.processed > 0 ? (job.processed / (job.processed + 1)) * 100 : 5}%` }} />
          </div>
          <div className="flex items-center justify-between text-xs text-[var(--color-text-dim)]">
            <span>{job.processed} processed</span>
            <span className="flex gap-3">
              <span className="text-green-400">{job.succeeded} ok</span>
              <span className="text-red-400">{job.failed} failed</span>
              <span>{job.skipped} skipped</span>
            </span>
          </div>
          {job.log.length > 0 && (
            <div className="mt-3 max-h-32 overflow-y-auto text-xs font-mono text-[var(--color-text-dim)] space-y-0.5">
              {job.log.slice(-8).map((line, i) => <p key={i}>{line}</p>)}
            </div>
          )}
        </div>
      )}

      {/* Retry buttons */}
      {stats && (stats.failed > 0 || stats.skipped > 0) && job?.status !== "running" && (
        <div className="flex items-center gap-2">
          {stats.failed > 0 && (
            <button onClick={() => handleStartSubmission("retry-failed")} disabled={loading.submit} className="px-3 py-1.5 text-xs font-medium bg-red-400/10 text-red-400 border border-red-400/30 rounded-lg hover:bg-red-400/20 transition-all disabled:opacity-40 flex items-center gap-1">
              <RefreshCw size={12} /> Retry Failed ({stats.failed})
            </button>
          )}
          {stats.skipped > 0 && (
            <button onClick={() => handleStartSubmission("retry-skipped")} disabled={loading.submit} className="px-3 py-1.5 text-xs font-medium bg-yellow-400/10 text-yellow-400 border border-yellow-400/30 rounded-lg hover:bg-yellow-400/20 transition-all disabled:opacity-40 flex items-center gap-1">
              <RefreshCw size={12} /> Retry Skipped ({stats.skipped})
            </button>
          )}
          {stats.failed > 0 && stats.skipped > 0 && (
            <button onClick={() => handleStartSubmission("retry-both")} disabled={loading.submit} className="px-3 py-1.5 text-xs font-medium bg-orange-400/10 text-orange-400 border border-orange-400/30 rounded-lg hover:bg-orange-400/20 transition-all disabled:opacity-40 flex items-center gap-1">
              <RefreshCw size={12} /> Retry All
            </button>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-[var(--color-border)]">
        {(["sites", "posts", "submissions", "platforms", "settings"] as Tab[]).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2.5 text-sm font-medium capitalize transition-colors border-b-2 ${activeTab === tab ? "text-[var(--color-accent)] border-[var(--color-accent)]" : "text-[var(--color-text-dim)] border-transparent hover:text-[var(--color-text)]"}`}>
            {tab}
          </button>
        ))}
      </div>

      {/* ========== Sites Tab ========== */}
      {activeTab === "sites" && (
        <div className="space-y-3">
          {sites.length === 0 ? (
            <div className="text-center py-16 text-[var(--color-text-dim)]">
              <Bookmark size={40} className="mx-auto mb-3 opacity-40" />
              <p className="text-sm">No sites added yet. Click &quot;Add Site&quot; to get started.</p>
            </div>
          ) : (
            sites.map((site) => (
              <div key={site.id} className={`p-4 bg-[var(--color-bg-card)] border rounded-xl transition-all ${site.id === selectedSiteId ? "border-[var(--color-accent)]/50" : "border-[var(--color-border)] hover:border-[var(--color-border-hover)]"}`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm">{site.name}</h3>
                    <a href={site.url} target="_blank" rel="noopener noreferrer" className="text-xs text-[var(--color-accent)] hover:underline flex items-center gap-1">
                      {site.url} <ExternalLink size={10} />
                    </a>
                    <p className="text-xs text-[var(--color-text-dim)] mt-1">{site.description}</p>
                    {(site.sitemapUrl || site.rssUrl) && (
                      <div className="flex gap-2 mt-1.5">
                        {site.sitemapUrl && <span className="text-[10px] px-1.5 py-0.5 bg-[var(--color-bg)] border border-[var(--color-border)] rounded">Sitemap</span>}
                        {site.rssUrl && <span className="text-[10px] px-1.5 py-0.5 bg-[var(--color-bg)] border border-[var(--color-border)] rounded">RSS</span>}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 ml-3">
                    <button onClick={() => { setEditingSite(site); setShowAddSite(true); }} className="p-1.5 text-[var(--color-text-dim)] hover:text-[var(--color-accent)] transition-colors">
                      <RefreshCw size={14} />
                    </button>
                    <button onClick={() => handleDeleteSite(site.id)} className="p-1.5 text-[var(--color-text-dim)] hover:text-red-400 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ========== Posts Tab ========== */}
      {activeTab === "posts" && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <button onClick={handleFetchPosts} disabled={loading.fetch || !selectedSiteId} className="px-4 py-2 text-sm font-medium bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white rounded-lg transition-all disabled:opacity-50 flex items-center gap-2">
              {loading.fetch ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              Fetch Posts from Sitemap/RSS
            </button>
            <button onClick={() => handleStartSubmission("new")} disabled={loading.submit || job?.status === "running" || posts.length === 0} className="px-4 py-2 text-sm font-medium bg-[var(--color-green)]/10 text-[var(--color-green)] border border-[var(--color-green)]/30 rounded-lg hover:bg-[var(--color-green)]/20 transition-all disabled:opacity-40 flex items-center gap-2">
              {loading.submit ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              Submit {selectedPostIds.size > 0 ? `${selectedPostIds.size} Selected` : "All"} to Platforms
            </button>
          </div>
          {errors.fetch && <p className="text-xs text-red-400 flex items-center gap-1"><AlertCircle size={12} /> {errors.fetch}</p>}
          {errors.submit && <p className="text-xs text-red-400 flex items-center gap-1"><AlertCircle size={12} /> {errors.submit}</p>}

          {posts.length === 0 ? (
            <div className="text-center py-16 text-[var(--color-text-dim)]">
              <FileText size={40} className="mx-auto mb-3 opacity-40" />
              <p className="text-sm">No posts yet. Click &quot;Fetch Posts&quot; to discover content from your sitemap or RSS feed.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 text-xs text-[var(--color-text-dim)]">
                <button onClick={toggleAllPosts} className="text-[var(--color-accent)] hover:underline">
                  {selectedPostIds.size === posts.length ? "Deselect All" : "Select All"}
                </button>
                <span>{posts.length} post(s) found</span>
                {selectedPostIds.size > 0 && <span className="text-[var(--color-accent)]">{selectedPostIds.size} selected</span>}
              </div>
              <div className="space-y-1.5 max-h-[500px] overflow-y-auto">
                {posts.map((post) => (
                  <div key={post.id} className={`p-3 bg-[var(--color-bg-card)] border rounded-lg flex items-start gap-3 transition-all cursor-pointer ${selectedPostIds.has(post.id) ? "border-[var(--color-accent)]/50" : "border-[var(--color-border)]"}`} onClick={() => togglePostSelection(post.id)}>
                    <input type="checkbox" checked={selectedPostIds.has(post.id)} onChange={() => {}} className="mt-1 accent-[var(--color-accent)]" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{post.title}</p>
                      <a href={post.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-[var(--color-accent)] hover:underline truncate block" onClick={(e) => e.stopPropagation()}>
                        {post.url}
                      </a>
                      {post.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {post.tags.slice(0, 4).map((t) => (
                            <span key={t} className="text-[10px] px-1 py-0.5 bg-[var(--color-bg)] border border-[var(--color-border)] rounded">{t}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-bg)] border border-[var(--color-border)] shrink-0">{post.source}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ========== Submissions Tab ========== */}
      {activeTab === "submissions" && (
        <div className="space-y-2">
          {submissions.length === 0 ? (
            <div className="text-center py-16 text-[var(--color-text-dim)]">
              <Send size={40} className="mx-auto mb-3 opacity-40" />
              <p className="text-sm">No submissions yet. Go to Posts tab, fetch posts, and submit them.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)]">
                    <th className="text-left py-2 px-3 text-xs font-medium text-[var(--color-text-dim)]">Platform</th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-[var(--color-text-dim)]">Post</th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-[var(--color-text-dim)]">Status</th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-[var(--color-text-dim)]">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {submissions.map((sub) => {
                    const plat = platforms.find((p) => p.id === sub.platformId);
                    const post = posts.find((p) => p.id === sub.postId);
                    return (
                      <tr key={sub.id} className="border-b border-[var(--color-border)]/50 hover:bg-[var(--color-bg-card)]">
                        <td className="py-2 px-3">
                          <span className="font-medium text-[var(--color-text)]">{plat?.name || sub.platformId}</span>
                          {plat && <span className="block text-[10px] text-[var(--color-text-dim)]">DA {plat.da}{plat.doFollow ? " · dofollow" : ""}</span>}
                        </td>
                        <td className="py-2 px-3 text-xs text-[var(--color-text-dim)] max-w-[200px] truncate">{post?.title || sub.postId}</td>
                        <td className="py-2 px-3">{statusBadge(sub.status)}</td>
                        <td className="py-2 px-3 text-xs text-[var(--color-text-dim)] max-w-xs truncate">{sub.errorMessage || sub.notes || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========== Platforms Tab ========== */}
      {activeTab === "platforms" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {Object.entries(platStats).map(([type, count]) => (
              <span key={type} className="text-xs px-2 py-1 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg">{type}: <strong>{count}</strong></span>
            ))}
            <span className="text-xs px-2 py-1 bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/30 text-[var(--color-accent)] rounded-lg font-medium">Total: {platforms.length}</span>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {platforms.map((plat) => (
              <div key={plat.id} className="p-3 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg hover:border-[var(--color-border-hover)] transition-all">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-sm">{plat.name}</span>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border text-[var(--color-accent)] border-[var(--color-accent)]/30">DA {plat.da}</span>
                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${plat.doFollow ? "text-green-400 border-green-400/30" : "text-[var(--color-text-dim)] border-[var(--color-border)]"}`}>
                      {plat.doFollow ? "dofollow" : "nofollow"}
                    </span>
                  </div>
                </div>
                <a href={plat.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-[var(--color-accent)] hover:underline flex items-center gap-1">{plat.url} <ExternalLink size={8} /></a>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-[10px] px-1.5 py-0.5 bg-[var(--color-bg)] border border-[var(--color-border)] rounded capitalize">{plat.type}</span>
                  {plat.requiresAccount && <span className="text-[10px] text-[var(--color-text-dim)]">account required</span>}
                </div>
                {plat.notes && <p className="text-[10px] text-[var(--color-text-dim)] mt-1">{plat.notes}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========== Settings Tab ========== */}
      {activeTab === "settings" && (
        <div className="space-y-6 max-w-lg">
          <div className="p-5 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <Key size={16} className="text-[var(--color-accent)]" />
              <h3 className="font-semibold text-sm">CAPTCHA Solving (2Captcha)</h3>
            </div>
            <p className="text-xs text-[var(--color-text-dim)]">Enable automatic CAPTCHA solving for platforms that require it.</p>
            <div className="flex items-center justify-between">
              <label className="text-sm text-[var(--color-text)]">Enable CAPTCHA Solving</label>
              <button onClick={() => setCaptchaSettings((p) => ({ ...p, solveCaptchas: !p.solveCaptchas }))} className={`relative w-11 h-6 rounded-full transition-colors ${captchaSettings.solveCaptchas ? "bg-[var(--color-accent)]" : "bg-[var(--color-border)]"}`}>
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${captchaSettings.solveCaptchas ? "translate-x-5" : ""}`} />
              </button>
            </div>
            <div>
              <label className="text-xs text-[var(--color-text-dim)] mb-1 block">2Captcha API Key</label>
              <div className="relative">
                <input type={showApiKey ? "text" : "password"} value={apiKeyInput || (captchaSettings.hasApiKey ? captchaSettings.twoCaptchaApiKey : "")} onChange={(e) => setApiKeyInput(e.target.value)} placeholder="Enter API key" className="w-full px-3 py-2.5 pr-10 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-dim)] focus:outline-none focus:border-[var(--color-accent)] font-mono" />
                <button onClick={() => setShowApiKey(!showApiKey)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--color-text-dim)] hover:text-[var(--color-text)]">
                  {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
            {errors.settings && <p className="text-xs text-red-400 flex items-center gap-1"><AlertCircle size={12} /> {errors.settings}</p>}
            <button onClick={handleSaveSettings} disabled={loading.settings} className="w-full py-2.5 text-sm font-semibold bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white rounded-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2">
              {loading.settings ? <><Loader2 size={14} className="animate-spin" /> Saving...</> : <><Settings size={14} /> Save Settings</>}
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      {showAddSite && (
        <AddSiteModal onClose={() => { setShowAddSite(false); setEditingSite(null); }} onSave={handleSaveSite} editing={editingSite} />
      )}
    </div>
  );
}
