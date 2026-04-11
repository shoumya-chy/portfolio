"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Play, RefreshCw, Settings, Trash2, ExternalLink, Check, X, Clock } from "lucide-react";

interface PinterestSite {
  id: string;
  name: string;
  wpBaseUrl: string;
  wpUsername: string;
  wpAppPassword: string;
  pinterestAccessToken: string;
  pinterestBoardId: string;
  pinsPerDay: number;
  active: boolean;
  createdAt: string;
}

interface PinnedPost {
  postUrl: string;
  postTitle: string;
  pinId: string;
  pinnedAt: string;
  siteId: string;
  pinTitle: string;
  status: "pinned" | "failed";
  error?: string;
}

interface JobStatus {
  jobId: string;
  siteId: string;
  status: "running" | "completed" | "failed";
  message: string;
  current: number;
  total: number;
  log: string[];
  result?: { attempted: number; published: number; failed: number };
  error?: string;
}

type Tab = "dashboard" | "sites" | "log";

export function PinterestDashboard({ onLogout }: { onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [sites, setSites] = useState<PinterestSite[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string>("");
  const [pinnedLog, setPinnedLog] = useState<PinnedPost[]>([]);
  const [job, setJob] = useState<JobStatus | null>(null);
  const [showAddSite, setShowAddSite] = useState(false);
  const [editSite, setEditSite] = useState<PinterestSite | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"all" | "pinned" | "failed">("all");

  // Form state
  const [form, setForm] = useState({
    name: "", wpBaseUrl: "", wpUsername: "", wpAppPassword: "",
    pinterestAccessToken: "", pinterestBoardId: "", pinsPerDay: 10,
  });

  const fetchSites = useCallback(async () => {
    try {
      const res = await fetch("/api/tools/pinterest/sites");
      const data = await res.json();
      setSites(data.sites || []);
      if (!selectedSiteId && data.sites?.length > 0) {
        setSelectedSiteId(data.sites[0].id);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [selectedSiteId]);

  const fetchPinnedLog = useCallback(async () => {
    if (!selectedSiteId) return;
    try {
      const res = await fetch(`/api/tools/pinterest/pinned-log?siteId=${selectedSiteId}`);
      const data = await res.json();
      setPinnedLog(data.log || []);
    } catch { /* ignore */ }
  }, [selectedSiteId]);

  const fetchJobStatus = useCallback(async () => {
    if (!selectedSiteId) return;
    try {
      const res = await fetch(`/api/tools/pinterest/job-status?siteId=${selectedSiteId}`);
      const data = await res.json();
      setJob(data.job || null);
    } catch { /* ignore */ }
  }, [selectedSiteId]);

  useEffect(() => { fetchSites(); }, [fetchSites]);
  useEffect(() => { fetchPinnedLog(); fetchJobStatus(); }, [selectedSiteId, fetchPinnedLog, fetchJobStatus]);

  // Poll job status when running
  useEffect(() => {
    if (job?.status !== "running") return;
    const interval = setInterval(() => {
      fetchJobStatus();
      fetchPinnedLog();
    }, 3000);
    return () => clearInterval(interval);
  }, [job?.status, fetchJobStatus, fetchPinnedLog]);

  const selectedSite = sites.find(s => s.id === selectedSiteId);
  const pinnedCount = pinnedLog.filter(p => p.status === "pinned").length;
  const failedCount = pinnedLog.filter(p => p.status === "failed").length;
  const lastRun = pinnedLog.length > 0
    ? new Date(pinnedLog[pinnedLog.length - 1].pinnedAt).toLocaleDateString()
    : "Never";

  const runPipeline = async () => {
    if (!selectedSiteId) return;
    try {
      await fetch("/api/tools/pinterest/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId: selectedSiteId }),
      });
      fetchJobStatus();
    } catch { /* ignore */ }
  };

  const saveSite = async (isEdit: boolean) => {
    const method = isEdit ? "PUT" : "POST";
    const payload = isEdit ? { ...form, id: editSite?.id } : form;
    try {
      const res = await fetch("/api/tools/pinterest/sites", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setShowAddSite(false);
        setEditSite(null);
        setForm({ name: "", wpBaseUrl: "", wpUsername: "", wpAppPassword: "", pinterestAccessToken: "", pinterestBoardId: "", pinsPerDay: 10 });
        fetchSites();
      }
    } catch { /* ignore */ }
  };

  const removeSite = async (id: string) => {
    if (!confirm("Delete this site?")) return;
    try {
      await fetch(`/api/tools/pinterest/sites?id=${id}`, { method: "DELETE" });
      if (selectedSiteId === id) setSelectedSiteId("");
      fetchSites();
    } catch { /* ignore */ }
  };

  const openEditSite = (site: PinterestSite) => {
    setEditSite(site);
    setForm({
      name: site.name,
      wpBaseUrl: site.wpBaseUrl,
      wpUsername: site.wpUsername,
      wpAppPassword: site.wpAppPassword,
      pinterestAccessToken: site.pinterestAccessToken,
      pinterestBoardId: site.pinterestBoardId,
      pinsPerDay: site.pinsPerDay,
    });
    setShowAddSite(true);
  };

  const filteredLog = statusFilter === "all"
    ? pinnedLog
    : pinnedLog.filter(p => p.status === statusFilter);

  if (loading) {
    return <div className="flex items-center justify-center py-20">
      <div className="w-6 h-6 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
    </div>;
  }

  return (
    <div>
      {/* Admin bar */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-500" />
          <span className="text-sm text-[var(--color-text-muted)]">Admin Mode</span>
        </div>
        <button onClick={onLogout} className="text-sm text-[var(--color-text-dim)] hover:text-[var(--color-text-muted)] transition-colors">
          Logout
        </button>
      </div>

      {/* Site selector */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <select
          value={selectedSiteId}
          onChange={e => setSelectedSiteId(e.target.value)}
          className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm flex-1 max-w-sm"
        >
          <option value="">Select a site...</option>
          {sites.map(s => (
            <option key={s.id} value={s.id}>{s.name} ({new URL(s.wpBaseUrl).hostname})</option>
          ))}
        </select>
        <button
          onClick={() => { setEditSite(null); setForm({ name: "", wpBaseUrl: "", wpUsername: "", wpAppPassword: "", pinterestAccessToken: "", pinterestBoardId: "", pinsPerDay: 10 }); setShowAddSite(true); }}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg text-sm hover:bg-red-500/20 transition"
        >
          <Plus size={14} /> Add Site
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-[var(--color-border)]">
        {(["dashboard", "sites", "log"] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm capitalize transition-colors border-b-2 -mb-px ${
              tab === t ? "border-red-400 text-red-400" : "border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Dashboard Tab */}
      {tab === "dashboard" && selectedSite && (
        <div>
          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            {[
              { label: "Total Pins", value: pinnedLog.length, color: "text-[var(--color-text)]" },
              { label: "Published", value: pinnedCount, color: "text-green-400" },
              { label: "Failed", value: failedCount, color: "text-red-400" },
              { label: "Last Run", value: lastRun, color: "text-[var(--color-text-muted)]" },
            ].map((stat, i) => (
              <div key={i} className="p-4 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl">
                <p className="text-xs text-[var(--color-text-dim)] mb-1">{stat.label}</p>
                <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
              </div>
            ))}
          </div>

          {/* Run button */}
          <div className="mb-6">
            {job?.status === "running" ? (
              <div className="p-4 bg-[var(--color-bg-card)] border border-amber-500/30 rounded-xl">
                <div className="flex items-center gap-2 mb-2">
                  <RefreshCw size={16} className="text-amber-400 animate-spin" />
                  <span className="text-sm font-medium text-amber-400">Pipeline Running</span>
                </div>
                <p className="text-sm text-[var(--color-text-muted)] mb-2">{job.message}</p>
                {job.total > 0 && (
                  <div className="w-full bg-[var(--color-border)] rounded-full h-2">
                    <div
                      className="bg-amber-400 h-2 rounded-full transition-all"
                      style={{ width: `${Math.min(100, (job.current / job.total) * 100)}%` }}
                    />
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={runPipeline}
                disabled={!selectedSiteId}
                className="inline-flex items-center gap-2 px-6 py-3 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 transition disabled:opacity-50"
              >
                <Play size={18} /> Run Today&apos;s Pins
              </button>
            )}

            {job?.status === "completed" && job.result && (
              <div className="mt-3 p-4 bg-green-500/5 border border-green-500/20 rounded-xl">
                <p className="text-sm text-green-400">
                  {job.result.attempted} attempted — {job.result.published} published, {job.result.failed} failed
                </p>
              </div>
            )}

            {job?.status === "failed" && (
              <div className="mt-3 p-4 bg-red-500/5 border border-red-500/20 rounded-xl">
                <p className="text-sm text-red-400">{job.error || job.message}</p>
              </div>
            )}
          </div>

          {/* Pinned log table */}
          <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
              <h3 className="font-medium">Pin History</h3>
              <div className="flex gap-1">
                {(["all", "pinned", "failed"] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setStatusFilter(f)}
                    className={`px-2 py-1 text-xs rounded capitalize ${
                      statusFilter === f
                        ? "bg-red-500/20 text-red-400"
                        : "text-[var(--color-text-dim)] hover:text-[var(--color-text-muted)]"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {filteredLog.length === 0 ? (
              <p className="p-6 text-center text-sm text-[var(--color-text-dim)]">
                No pins yet. Click &quot;Run Today&apos;s Pins&quot; to start.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[var(--color-text-dim)] text-xs">
                      <th className="text-left p-3 font-medium">Post Title</th>
                      <th className="text-left p-3 font-medium">Status</th>
                      <th className="text-left p-3 font-medium">Pinned Date</th>
                      <th className="text-left p-3 font-medium">Pin ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...filteredLog].reverse().map((pin, i) => (
                      <tr key={i} className="border-t border-[var(--color-border)] hover:bg-white/[0.02]">
                        <td className="p-3">
                          <a
                            href={pin.postUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-red-400 transition-colors inline-flex items-center gap-1"
                          >
                            {pin.postTitle.slice(0, 60)}{pin.postTitle.length > 60 ? "..." : ""}
                            <ExternalLink size={12} />
                          </a>
                        </td>
                        <td className="p-3">
                          {pin.status === "pinned" ? (
                            <span className="inline-flex items-center gap-1 text-green-400 text-xs">
                              <Check size={12} /> Pinned
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-red-400 text-xs" title={pin.error}>
                              <X size={12} /> Failed
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-[var(--color-text-dim)]">
                          <span className="inline-flex items-center gap-1">
                            <Clock size={12} />
                            {new Date(pin.pinnedAt).toLocaleDateString()}
                          </span>
                        </td>
                        <td className="p-3 text-[var(--color-text-dim)] font-mono text-xs">
                          {pin.pinId ? pin.pinId.slice(0, 16) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "dashboard" && !selectedSite && (
        <div className="p-8 text-center text-[var(--color-text-dim)]">
          Select a site or add one to get started.
        </div>
      )}

      {/* Sites Tab */}
      {tab === "sites" && (
        <div className="space-y-4">
          {sites.length === 0 ? (
            <p className="text-center text-[var(--color-text-dim)] py-8">No sites configured yet.</p>
          ) : (
            sites.map(site => (
              <div key={site.id} className="p-4 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium">{site.name}</h3>
                  <div className="flex gap-2">
                    <button onClick={() => openEditSite(site)} className="text-[var(--color-text-dim)] hover:text-[var(--color-text-muted)]">
                      <Settings size={14} />
                    </button>
                    <button onClick={() => removeSite(site.id)} className="text-[var(--color-text-dim)] hover:text-red-400">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-[var(--color-text-dim)]">
                  <div>
                    <span className="text-[var(--color-text-muted)]">WordPress:</span>{" "}
                    {new URL(site.wpBaseUrl).hostname}
                  </div>
                  <div>
                    <span className="text-[var(--color-text-muted)]">Board:</span>{" "}
                    {site.pinterestBoardId || "Not set"}
                  </div>
                  <div>
                    <span className="text-[var(--color-text-muted)]">Pins/Day:</span>{" "}
                    {site.pinsPerDay}
                  </div>
                  <div>
                    <span className="text-[var(--color-text-muted)]">Pinterest:</span>{" "}
                    {site.pinterestAccessToken ? "Connected" : "Not connected"}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Log Tab */}
      {tab === "log" && job && (
        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-4">
          <h3 className="font-medium mb-3">Job Log — {job.status}</h3>
          <div className="max-h-96 overflow-y-auto space-y-1 font-mono text-xs">
            {job.log.map((line, i) => (
              <div key={i} className={`py-0.5 ${
                line.includes("✓") ? "text-green-400" : line.includes("✗") ? "text-red-400" : "text-[var(--color-text-dim)]"
              }`}>
                {line}
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "log" && !job && (
        <p className="text-center text-[var(--color-text-dim)] py-8">No job has been run yet.</p>
      )}

      {/* Add/Edit Site Modal */}
      {showAddSite && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold mb-4">{editSite ? "Edit Site" : "Add Site"}</h2>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-[var(--color-text-muted)] mb-1 block">Site Name</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm"
                  placeholder="New Life In Aus" />
              </div>
              <div>
                <label className="text-xs text-[var(--color-text-muted)] mb-1 block">WordPress URL</label>
                <input value={form.wpBaseUrl} onChange={e => setForm({ ...form, wpBaseUrl: e.target.value })}
                  className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm"
                  placeholder="https://newlifeinaus.com.au" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[var(--color-text-muted)] mb-1 block">WP Username</label>
                  <input value={form.wpUsername} onChange={e => setForm({ ...form, wpUsername: e.target.value })}
                    className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-[var(--color-text-muted)] mb-1 block">WP App Password</label>
                  <input type="password" value={form.wpAppPassword} onChange={e => setForm({ ...form, wpAppPassword: e.target.value })}
                    className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="text-xs text-[var(--color-text-muted)] mb-1 block">Pinterest Access Token</label>
                <input type="password" value={form.pinterestAccessToken} onChange={e => setForm({ ...form, pinterestAccessToken: e.target.value })}
                  className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm"
                  placeholder="pina_..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[var(--color-text-muted)] mb-1 block">Board ID</label>
                  <input value={form.pinterestBoardId} onChange={e => setForm({ ...form, pinterestBoardId: e.target.value })}
                    className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm"
                    placeholder="Pinterest board ID" />
                </div>
                <div>
                  <label className="text-xs text-[var(--color-text-muted)] mb-1 block">Pins Per Day</label>
                  <input type="number" value={form.pinsPerDay} onChange={e => setForm({ ...form, pinsPerDay: parseInt(e.target.value) || 10 })}
                    className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm"
                    min={1} max={50} />
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => saveSite(!!editSite)}
                disabled={!form.name || !form.wpBaseUrl}
                className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 transition disabled:opacity-50"
              >
                {editSite ? "Save Changes" : "Add Site"}
              </button>
              <button
                onClick={() => { setShowAddSite(false); setEditSite(null); }}
                className="px-4 py-2 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
